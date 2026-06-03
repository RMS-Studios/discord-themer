use serde::Serialize;

#[derive(Debug, Serialize)]
pub enum ValidationResult {
    Safe,
    Blocked(String),
    RequiresReview(String),
}

pub fn validate_css(content: &str) -> ValidationResult {
    if content.len() > 512_000 {
        return ValidationResult::Blocked("CSS file exceeds 500KB limit".into());
    }
    let blocked = ["@import url(", "expression(", "javascript:", "-moz-binding", "behavior:", "<script"];
    let lower = content.to_lowercase();
    for p in &blocked {
        if lower.contains(p) {
            return ValidationResult::Blocked(format!("Unsafe pattern: '{}'", p));
        }
    }
    ValidationResult::Safe
}

pub fn validate_js(content: &str) -> ValidationResult {
    if content.len() > 1_048_576 {
        return ValidationResult::Blocked("JS file exceeds 1MB limit".into());
    }
    let blocked = [
        "require('child_process')", "require(\"child_process\")",
        "process.exit(", "shell.exec(",
    ];
    let review = ["eval(", "new Function(", "process.env", "XMLHttpRequest"];
    for p in &blocked {
        if content.contains(p) {
            return ValidationResult::Blocked(format!("Dangerous API: '{}'", p));
        }
    }
    for p in &review {
        if content.contains(p) {
            return ValidationResult::RequiresReview(format!("Risky usage: '{}'", p));
        }
    }
    ValidationResult::Safe
}
