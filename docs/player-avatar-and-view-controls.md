<!-- Nodevision/docs/player-avatar-and-view-controls.md -->
<!-- This report explains player foot alignment, shared console transitions and the capped ground jump. -->

# Player avatar and view controls

The player reference position is at eye height. Physical feet are `referenceY - playerHeight`, with standing height 1.75 m. The old fallback avatar was about 1.615 m tall, had its lowest point at local Y=.175, and was positioned only half a player height below the eye reference. Its feet therefore appeared about 1.05 m above physical ground.

`GameViewDependencies/playerAvatarVisual.mjs` now owns a foot-origin fallback with explicit feet and a total standing height of 1.75 m. Loaded GLTF bounds are normalized to the same height, centered horizontally and moved to local bottom Y=0. The avatar root follows `referenceY - playerHeight` each update, with vertical scaling for crouch. It does not smooth feet independently of the physical player. Collider dimensions and first-person eye position remain unchanged.

`cameraModes.mjs` uses that helper and frames third person around the upper body: target eye minus .25 player heights, camera follow height eye plus .65 player heights. It exposes the same shared cycle to the console. Loaded avatar normalization uses static bounds; animated feet/poses and unusually posed custom models may still require rig-specific adjustment. This is not skeletal inverse kinematics.

The existing U request is handled by the movement loop and the canonical mode controller in `cameraModes.mjs`. `textWorldConsole.mjs` owns the HTML console overlay. `textConsoleClose.mjs` adds one accessible upper-right × button which calls the controller's same `cycleMode()` transition. U also reaches that transition while focus is inside the console, with repeated/modifier key events excluded. Camera mode is authoritative for console visibility, preventing a stale text view field from retaining the overlay.

Button pointer events stop propagation to the world. Closing cancels deferred input focus, blurs console inputs and restores focus to the canvas without forcing pointer lock. Listener teardown uses an AbortController; the overlay/button is removed on disposal. No second camera state controller was added.

`playerJump.mjs` caps normal ground jumps at 0.6 m after requested speed, crouch and skill multipliers. The cap accounts for the gravity-before-position integration order in `movementSteps.mjs`: `sqrt(2*g*0.6) + g/2`. At default gravity .012, the impulse is .126 and the discrete apex is .6 m. Swimming, flight, material bounce and zero-gravity propulsion retain their separate behavior.

Tests: `playerBody.test.mjs` covers fallback/custom normalization, standing/crouch foot heights at multiple ground elevations, and discrete jump apex/landing over gravity and multiplier variations. `scripts/player-view-browser.mjs` checks real third-person feet, first-person visibility, unique button placement, click propagation, focused U behavior and canvas focus through the Sandbox session harness. Both Build and Play use the normal shared Game View implementation. Eight test files and both normal-world/Sandbox Electron harnesses pass; no user avatar file is required for fallback behavior.
