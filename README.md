# 🎨 discord-themer

> ⚠️ **This repository is archived and unmaintained.**
> 
> **DO NOT try to use this.** It almost certainly does not work with modern Discord and will likely just break your client. You have been warned.

---

## What is this?

discord-themer is the project that started it all. Before **RMS**, before **RMS Studios** — this was the very first attempt at a Discord client modification, built by one person with no idea it would eventually turn into something real.

It started as a simple JavaScript loader that required **manual asar patching** directly into Discord's app files. No installer. No updater. No desktop client. Just a JS file, a text editor, and a prayer that Discord wouldn't update overnight and break everything 🙏

Over time it grew into something more — a full React + Tailwind UI, plugin manager, theme manager, marketplace, custom CSS editor, keybind manager, backup manager, and even BetterDiscord theme compatibility. All built by one person who was just figuring things out.

Eventually the ideas and lessons learned here became the foundation for **RMS** — a proper Discord client modification with hundreds of plugins, full theme support, an Android client, and a whole community.

## The icon

Yes, the icon was literally just 🎨. No logo. No branding. No designer. Just a paint emoji slapped on it and called it a day. Somehow it worked. We don't talk about it.

## The evolution

```
🎨 discord-themer  (you are here — the beginning)
        ↓
RMS  (proper Discord client mod)
        ↓
RMS Studios  (RMS, RMSTop, RMSDroid, RMSWeb)
```

## Why is this archived?

Manual asar patching is fragile by nature — Discord updates constantly and any client update would break the injection. Modern client mods like RMS solve this properly with a dedicated preload injection system that actually works reliably.

This repo exists purely as a historical artifact. A reminder of where everything started. Nothing more.

## Can I use this code?

Sure! Take it, fork it, modify it, do whatever you want with it. It's yours 🎉

Just know that if you try to actually use it with Discord... good luck. You're gonna need it 😭

## Check out RMS

If you're looking for something that actually works, check out the modern version:

- **RMS** — https://github.com/zxkuhl/RMS
- **RMSTop** — Desktop client with RMS built in
- **RMSDroid** — RMS on Android
- **Website** — https://rms.rmsstudios.site
- **Discord** — https://discord.gg/MtCTseeyPZ

---

*Built by [zxkuhl](https://github.com/zxkuhl) · RMS Studios · The beginning of something*