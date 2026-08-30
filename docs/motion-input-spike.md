# Motion input: what a library would buy us

Spike, 2026-08-30. Prompted by: *"research motion control libraries and options,
since kiyo is evolving."*

**The conclusion up front: no library, and it is not close.** Every candidate is
either unmaintained, licensed so we cannot use it, solving a problem the
operating system already solved for free, or implementing the exact design
`shake.ts` deliberately rejected. The spike is still worth its cost, because
looking at what the libraries *do* surfaced one real defect and two things we
are paying for by hand that the platform gives away.

Ranked by what they are worth:

1. **The motion path ignores screen orientation.** A defect, visible in
   landscape, and about six lines. (§2)
2. **We re-derive gravity from raw acceleration when both operating systems
   already publish a properly fused version.** `deviceorientation` is
   universal, needs no dependency, and is strictly better than the low-pass
   estimator at exactly the job entry 58 just started leaning on. (§3)
3. **The app never measures its own sample rate**, despite `PEAK_CEILING`
   having been recalibrated *because of* sample rate. (§4)

## 1. What we have, honestly

Worth stating plainly, because the answer to "should we adopt a library" turns
on it: `shake.ts` is ahead of the shake-detection libraries, not behind them.

- **Detection is oscillation-counting, not peak-thresholding.** `detectStrong`
  requires three direction reversals inside 1.2s, and its comment gives the
  reason: "putting the phone down hard clears any threshold a real shake
  clears". Every `shake.js`-shaped library on npm is the peak threshold. We
  would be adopting the bug we designed around.
- **There is a second, redundant detection path** (`SUSTAIN_LEVEL`) that exists
  because the precise one is brittle on real handsets, and it works on the
  normalised `disturb` so it does not care what absolute numbers a sensor
  reports. No library has this, because no library has been burned by it.
- **The integrator is chosen and commented** — semi-implicit Euler, because
  explicit Euler pumps energy into an under-damped oscillator.
- **`dt` is real and clamped**, kicks are scaled by it, and the fallback from
  `accelerationIncludingGravity` to `acceleration` is there with the note that
  omitting it silently kills the feature on some Android handsets.

That is more care than any of the candidates below carry. The gaps are not in
the physics; they are at the boundary, in what we read from the platform.

## 2. The defect: nothing compensates for screen orientation

`startShake`'s `onMotion` takes `a.x`/`a.y` and uses them directly against
screen axes. **Accelerometer axes are fixed to the device. Screen axes rotate.**
`screen.orientation.angle` is never read anywhere in `src/` — the two
`orientationchange` listeners that do exist (`main.ts:1160`, `hud.ts:1102`) are
both re-layout, and neither touches motion.

So in landscape, everything downstream of the sensor is rotated 90° against
the picture:

- `tilt()` reports lean along the device's short edge while the picture's x is
  along its long edge — so **the powder (entry 46) falls sideways**, which is
  the cheapest way to see this on a real phone.
- `gravity()`'s steady offset (entry 30) pushes the image the wrong way.
- `motion-bias.ts` rotates colour along `(tiltX, tiltY)`, so **the palette
  jumps when you rotate the phone** while the phone has not actually moved.
- The tumble's kick inverts the comment it is written under — "move the device
  right and the picture slides left" is true in portrait only.

The fix is a rotation of the `(x, y)` pair by `screen.orientation.angle` at the
sensor boundary, before anything else sees it. Two notes that make it smaller
than it sounds:

- **Only x and y need it.** `z` is along the screen normal in all four
  rotations, and so is `rotationRate.alpha`, so `spin` is already
  orientation-invariant.
- **One place.** Doing it inside `onMotion` means `Tumble` stays a pure
  function of screen-space samples and every consumer is fixed at once —
  rather than four call sites each remembering to rotate.

This is what `gyronorm.js` existed to do, and it is the one thing on the
library list we genuinely lack. It is also six lines.

## 3. We are estimating gravity that the OS already published

`sample()` maintains a 0.5s low-pass (`GRAVITY_TAU`) of raw acceleration and
calls the slow part gravity. The comment defends this well *against
differencing* — and differencing is indeed worse — but it does not address the
third option, which is not to estimate it at all.

A low-pass cannot distinguish gravity from any acceleration that lasts longer
than its time constant. So sustained motion leaks in: walking, a car, a train,
or simply moving the phone across a room. The phone then reports a lean it does
not have, and since **entry 58 just wired posture into colour**, the palette now
drifts while you walk — a new consequence of a filter chosen when nothing but
geometry consumed it.

The textbook fix is sensor fusion — integrate the gyro for the short term,
correct toward the accelerometer slowly. That is what every library in §5 sells,
and it is the wrong way to buy it, because **both operating systems already ran
that fusion and publish the result.** `deviceorientation`'s `beta`/`gamma` are
the fused, drift-corrected attitude, computed by the platform from accelerometer
plus gyroscope plus (where present) magnetometer, with vendor calibration we
cannot replicate. It is universal — iOS, Android, every engine — and it costs
nothing.

`DeviceOrientationEvent` appears nowhere in `src/`. We have never read it.

Two things to know before anyone builds this:

- **iOS has two separate permission gates.** `DeviceOrientationEvent
  .requestPermission()` is its own call, distinct from the
  `DeviceMotionEvent.requestPermission()` that `requestMotionAccess()` makes.
  Both must be asked, inside the same user gesture. Ask for orientation and
  forget motion, or the reverse, and the feature is silently dead on iPhone —
  which is this codebase's most-repeated failure mode.
- **Keep the low-pass as the fallback**, not as the primary. Where
  `deviceorientation` is absent or refused, today's estimator is exactly the
  right degraded behaviour, and it is already written.

The split that falls out: **orientation events for posture, motion events for
disturbance.** Each sensor doing the job it is actually good at, which is the
same shape as `docs/motion-as-a-continuum.md`'s own three tiers.

## 4. We never measure the sample rate we are calibrated against

`PEAK_CEILING`'s comment is a long, correct account of a sampling-rate problem:
45 was calibrated against a 6 Hz probe case, the same shake at 12 Hz reports
40.6, and the top rung was therefore unreachable on real hardware. `probe-shake
.ts` takes `hz` as a parameter for the same reason, noting iOS delivers ~60 Hz
and "Android delivers whatever the vendor chose, and 10-20 Hz is normal".

And yet `diagnostics()` reports `samples`, `peak` and `rejected` — never a rate.
The one number the whole calibration turns on is the one number the app cannot
see on the handset in front of you. The readout already exists to tell a dead
sensor from a weak shake; it should also tell a slow sensor from either, since
that is a third cause with the same symptom and a different fix.

Effective Hz over a short window, in the existing readout. Three lines, no
dependency. `DeviceMotionEvent.interval` is the platform's own claim about its
rate and is worth reporting beside the measured one, since a disagreement
between them is itself diagnostic.

## 5. The library landscape

| candidate | what it offers | why not |
|---|---|---|
| `ahrs` (psiphi75) | Madgwick / Mahony quaternion fusion | Solves §3 — which `deviceorientation` solves for free, better, with vendor calibration. A dependency to redo the OS's work. |
| `sensor-zoo` (Sensor Logger) | The most current of these: Madgwick, Mahony, EKF, complementary, step counting | Same objection. Genuinely good work, aimed at raw logged IMU data, which is not what a browser hands us. |
| `madgwick.js` | Madgwick, hand-translated from the C | Same objection, plus a decade unmaintained. |
| `gyronorm.js` | Screen-orientation normalisation (§2) + fusion | **Its author has publicly stopped maintaining it**, and it depends on FullTilt. |
| `full-tilt` | Promise-based normalisation of both event streams | **CC BY-NC 4.0 — non-commercial.** A licence stop before merit is even reached. |
| `motion-sensors-polyfill` / `sensor-polyfills` | Generic Sensor API shape on top of `devicemotion` | Reshapes an API we call in exactly one function, adds no fusion, and is years stale. |
| `shake.js` and its many clones | Peak-threshold shake detection | This is the design `detectStrong` rejects by name. Strictly backwards. |
| three.js `DeviceOrientationControls` | Orientation → camera quaternion | Deprecated out of core, and it drives a 3D camera; we composite in 2D. |
| Motion One / Popmotion / spring runtimes | Spring and easing solvers | Our spring is six lines of semi-implicit Euler with a written reason for the integrator. Kilobytes to replace correct code. |

Two structural reasons the whole column reads the same way. **This is a solved
problem that got absorbed into the platform** — the libraries date from
2014-2018, when browsers exposed raw events and nothing else, and the OS-side
fusion they wrap is now just there. And **a runtime dependency is a Hard Stop
here**: `three` is the only one, at 117 KB, and none of the above is worth
being the second.

The one genuinely modern option, the **Generic Sensor API**
(`LinearAccelerationSensor`, `GravitySensor`, requestable frequency), is real
and would remove the estimator outright on Android — where `devicemotion` is
worst. It is **not implemented in Safari or on iOS at all**, so it can only ever
be a second code path beside the one we must keep. Recommendation: **not now.**
If §3 lands, `deviceorientation` gets most of the same benefit on every
platform with one code path, and a second sensor stack earns its complexity only
if the first proves insufficient on a real Android handset.

## 6. What this would be, as work

Three entries, in this order, none of them large, none adding a dependency:

1. **Rotate the sensor pair by `screen.orientation.angle` in `onMotion`.**
   Fixes the powder, the gravity offset, the colour bias and the tumble
   direction at one seam. Verify in landscape, on a phone, with the powder.
2. **Read `deviceorientation` for posture, keeping the low-pass as fallback**,
   and ask both iOS permissions inside the one gesture. This is the one with a
   real design decision in it — the crossover between the two sources — and it
   should be captured with entry 58's numbers in hand.
3. **Report effective Hz in the diagnostics readout**, beside `interval`.
   Smallest of the three, and it is what makes the other two verifiable on
   hardware instead of by argument.

An honest caveat about verification, since it applies to all three: none of
this can be judged from a desktop browser, and `probe-shake.ts` cannot see any
of it either — the probe drives `Tumble` directly with synthetic samples, and
all three findings live *outside* `Tumble`, in the boundary code the probe does
not exercise. That boundary has no coverage today. Whoever builds §2 should
extend the probe to the sample-construction path rather than test the rotation
by eye.
