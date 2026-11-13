# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-11-13

### Fixed

- Use immediate feed scrolling when TikTok is hidden or unfocused to avoid suspended native animations.
- Use TikTok's native next-video callback to preserve its animated transition, with fallback navigation when unavailable.
- Intercept TikTok pause calls in the page execution context for more reliable background playback.
- Support newly created videos and videos started in the background, and stop offscreen videos to avoid overlapping playback when scrolling.
- Apply playback setting changes to open TikTok tabs without reloading, and restore normal playback behavior when disabled.
- Remove periodic video polling and forced playback retries.

### Added

- Optional, mutually exclusive modes to prevent video repetition or automatically scroll to the next video when playback ends, both disabled by default.
- Shared popup and settings controls that keep background playback as the primary feature.
- Automated tests for background playback, scrolling transitions, settings synchronization, and cleanup.

### Changed

- Require Chromium 111 or later for page execution context support.

## [1.0.1] - 2026-08-13

- New logo : Tiktok complained about the legacy logo to google. So I've updated it to prevent the extension being removed from Chrome Web Store

## [1.0.0] - 2025-11-04

- First release

---

[Unreleased]: https://github.com/YouG-o/Play-TikTok-Background/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/YouG-o/Play-TikTok-Background/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/YouG-o/Play-TikTok-Background/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/YouG-o/Simple-Changelog-Updater/releases/tag/v1.0.0
