# Aurora motion implementation specification

## 0. Scope, evidence, and units

This is a Next.js page using React Motion, CSS transitions, native timers, and Canvas 2D. There are no Framer appear ids, generated Framer scroll transforms, Framer tickers, or page preloaders. The first stack probe failed to detect Motion, but the captured component modules prove it is used. No Lenis is present. Keep native page scrolling.

The CSS breakpoints are `sm: 640px`, `md: 768px`, `lg: 1024px`, and `xl: 1280px`. Some component logic uses `(max-width: 768px)` inclusively while its CSS uses `md` at 768px. Preserve that boundary behavior. Generic Framer breakpoints in the rebuild template do not apply.

All transition durations and delays below are seconds. State-machine timer values and canvas repeat/delay values are milliseconds. Explicitly named pixel values are CSS pixels. Viewport entry mounts or resumes the illustration. It is not continuous scroll-progress animation. The only confirmed scroll-progress effect is the header's blur-mask opacity.

Evidence:

- `dom/full.html`: rendered selectors, classes, and serialized React Server Component props. `$L65` is the hero Meteor, `$L77` is the logo carousel, `$L97` is the testimonial ticker.
- `motion/animations.json`: 232 computed CSS transition/animation records and 170 CDP events. Events do not include a target mapping, so do not assign an unidentified event to a hero element.
- `dom/styles/stylesheet-c40c521895d32dd5.css`: full CSS, including all six keyframe definitions.
- `modules/supplement/`: executable animation definitions. Citations use content-addressed module names, internal numeric module ids, and character offsets where useful.
- `motion/transitions.json`: 201 Motion element records, 50 control effects, all state timelines, all observed CSS transitions, all CSS hover-class sets, hero path data, and ticker props. `sourceProps` contains exact JavaScript expressions. A source variable is resolved in the cited module, not guessed.

No frame sequence was available during this audit. Timing below is verified against definitions and observed animation events, not estimated from screenshots. Static captures can show a demo at an arbitrary point in its loop.

## 1. Shared transition constants

| Name | Exact definition | Usage |
|---|---|---|
| CTA | `{duration:.3,ease:[.4,.36,0,1]}` | Main links, support launcher, arrow exchanges |
| NAV_REST | `{duration:.45,ease:[.33,1,.68,1]}` | Header surfaces, label color, mark fills |
| NAV_HOVER | `{duration:.2,ease:[.33,1,.68,1]}` | Header hovered surfaces |
| NAV_BUTTON_REST | `{duration:.15,ease:[.33,1,.68,1]}` | Header sign-in/up |
| NAV_BUTTON_HOVER | `{duration:.1,ease:[.33,1,.68,1]}` | Header sign-in/up hover |
| CSS_DEFAULT | `{duration:.15,ease:[.4,0,.2,1]}` | Default transition-colors |
| ACCORDION | `{duration:.2,ease:[0,0,.2,1]}` | Component group padding, grid rows and opacity |
| MOSAIC_PAN | `{duration:1,ease:[.4,0,.2,1]}` | Component-grid camera |
| MOSAIC_FOCUS | `{duration:.5,ease:[.4,0,.2,1]}` | Foreground/background card opacity |
| LOGO_STEP | `{duration:1,ease:[.8,0,.2,1]}` | Customer logos |
| CURSOR_MOVE | `{duration:.6,ease:[.22,1,.36,1]}` | Autoplay demo cursors |
| CURSOR_CLICK | `{duration:.3}` with scale `[1,.85,1]` | Demo click gesture |
| COPY_SWAP | `{duration:.13,ease:[.175,.885,.32,1.1]}` | Copy/check icon and text swap |
| NAV_PANEL_SPRING | `{type:'spring',stiffness:400,damping:50}` | Header dropdown transform |
| QUOTE | `{duration:1.5,type:'spring',bounce:0}` | Quote mask reveal |

The feature cards also import two custom functions. These are not Motion's similarly named built-in easings:

```js
const featureEaseOut = t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
const featureEaseInOut = t => t < .5
  ? .5 * Math.pow(2, 16 * t - 8)
  : -.5 * Math.pow(2, -16 * t + 8) + 1;
```

Source: `module-d4e7cb84919b6b3d.js`, internal module `275921`. The same module exports cubic arrays: `motionEaseInOutBase [.25,.1,.25,1]`, `motionEaseInOutCubic [.65,0,.35,1]`, `motionEaseInOutQuad [.45,0,.55,1]`, `motionEaseInOutQuint [.83,0,.17,1]`, `motionEaseInOutSine [.37,0,.63,1]`, `motionEaseOutCubic [.33,1,.68,1]`, `motionEaseOutQuint [.22,1,.36,1]`, `motionSwiftOut [.175,.885,.32,1.1]`, and `motionAnticipate [1,-.4,.35,.95]`.

## 2. Header, navigation, and global buttons

Meaningful tree: `header.sticky > .header-background > outer rounded shell > inner surface > home link / navigation / account buttons / mobile toggle`. Menu items carry `[data-navitem]`; toggles carry `[data-state=open|closed]`.

- Header shell, labels, divider, and mark fills use NAV_REST, switching to NAV_HOVER while hovered. When one navigation item is hovered or open, inactive light-theme labels become `gray-500`; active remains `gray-950`. In dark theme inactive labels become `gray-300`, active remains `gray-50`.
- Chevron color/fill/stroke duration is `.45`; transform and opacity duration is `.2`, all using `[.33,1,.68,1]`.
- Sign-in/up light hover changes border from `rgba(19,19,22,0)` to `rgba(19,19,22,.12)` and background from transparent to `rgba(19,19,22,.02)`. Dark equivalents are white `.14` border and white `.05` background. Enter `.1`, leave `.15`, both NAV easing.
- Dropdown content uses transform spring `400/50`; opacity enters in `.3` with `[.33,1,.68,1]`; exit uses `.2` with the same cubic. The exact initial transform is in the corresponding header `sourceProps` record because start alignment and centered alignment use different translation origins.
- Inner menu headings enter from `translate3d(0,20 * direction px,0)` and opacity zero in `.3`; menu rows use `15 * direction px`, `.3`, and delay `(precedingItemCount + 1 + index) * .02 + .05`. Lower menu content uses delay `.1`.
- Mobile menu is opacity `0 -> 1 -> 0`, `.25`, `[.33,1,.68,1]`, with full `100dvh` height.
- Header blur mask is `useTransform(scrollY,[0,300],[0,1])`, overridden to `1` while mobile navigation is open. Blur component receives `maxBlur:16`, `layers:12`, `startPosition:40`. This is the confirmed reversible scroll-linked effect, without a spring.

Source: `module-1c52d8e9babbec24.js`, internal module `145937`; blur at character `114187`, menu rows at `136420`, mobile overlay at `154339`. CSS evidence: computed entries `1` through `33`.

CTA arrow exchange uses two coincident 10px SVGs. On hover, the first moves from `x:0,opacity:.6` to `x:24px,opacity:0`; the replacement moves from `x:-8px,opacity:0` to `x:0,opacity:1`. Both use CTA. Button top sheen is `::before` opacity `.5 -> 1` using CTA. No button scale press effect is specified for these links.

The hero prompt's copy/check icon uses opacity/filter/scale `.13`, `[.175,.885,.32,1.1]`. Its outer hover color transition is `.15 linear` when leaving and zero when entering. The footer build-with-agents button transitions grid columns in `.13 ease-in-out` and background/color in `.1 linear`; hover removes the latter durations. Its text restoration has `.1` delay. Exact state classes are in `cssInteractionInventory`.

## 3. Hero circuitry

There is no evidence of a page-wide hero text entrance. The hero's activity comes from two mirrored Canvas 2D Meteor instances behind static image layers. Do not add a generic heading fade or section spring.

Each half is a `969 x 887px` image composition. The left half has `scaleX(-1)`. Canvas style within each half is `left:504px; top:25px; width:403px; height:363px`. Each canvas uses four invisible SVG paths as its path-length and point sampling references.

| Path | Right repeat/delay ms | Left repeat/delay ms |
|---|---:|---:|
| 0 | 2000 / 0 | 1500 / 250 |
| 1 | 1500 / 400 | 1200 / 300 |
| 2 | 2300 / 500 | 1000 / 4000 |
| 3 | 1700 / 600 | 2000 / 500 |

Full path strings are in `transitions.json > codeComponents[0].instances`. Both instances use default settings: `segments:20`, `minSize:1.25`, `maxSize:1.25`, `gap:2.5`, `skip:0`, `speed:.3`, `wait:false`. Speed is `.3 CSS pixels per millisecond`, scaled by actual canvas width / design width. Total meteor length at default sizes is `20 * 1.25 + 19 * 2.5 = 72.5px`.

Gradient stops are `rgb(93 227 255 / 0)` at `0`, `rgb(93 227 255)` at `.5`, `rgb(108 71 255)` at `1`. Rendering uses a 10px glow sprite plus segmented path strokes, not one moving solid dash. DPR is clamped to `[1,2]`.

Renderer algorithm:

1. Create the 2D canvas at CSS dimensions times clamped DPR. Scale the drawing context by DPR. Obtain each path's `getTotalLength()` and a scaled `Path2D`.
2. On every frame, `elapsed = performance.now() - startTime` and `cycle = max(0,(elapsed - delay) % repeat)`.
3. `distance = skip * widthScale - meteorLength + cycle * speed * widthScale`. Reverse paths instead use `pathLength - distance - meteorLength`.
4. For each segment, add accumulated size plus gap to distance, sample the path, and draw a glow sprite at the midpoint at twice the segment size. Skip samples outside the path.
5. Fill a padded bounding box between the head and tail with the gradient using `source-atop`, then restore `source-over`.
6. Stroke each segment using line width `segmentSize * widthScale` and dash array `[0,segmentDistance,segmentSize,999999]`.
7. On leaving the viewport the `InView` wrapper unmounts the child, cleaning up RAF. Reentry remounts the canvas and restarts its relative timing.

Source: `module-efea02ecc1e1a537.js`, internal module `242116`, Meteor definition around character `4040`. Equivalent renderer is also present in `module-4ca19d8c8cb8695b.js`, character `41562`. Props: `dom/full.html`, serialized `$L65`. `InView`: `module-5d1cfd441e0cec9f.js`, internal module `340277`.

## 4. Customer logo columns

Four independent vertical logo carousels share `LOGO_STEP`. Initial delays are `2`, `2.1`, `2.2`, and `2.3`. Every movement advances the list exactly `-100%` of one row, followed by a `2.3` pause. First three columns contain three unique companies; the fourth contains two. Each appends a duplicate of its first logo, then resets seamlessly when the whole sequence repeats.

This is stepped vertical movement, not a horizontal marquee. `repeat:Infinity`. No hover pause or drag handler is present. Each column's viewport mask is:

```css
mask-image: linear-gradient(to bottom,
  transparent calc(50% - 2.5rem),
  black calc(50% - 1rem),
  black calc(50% + 1rem),
  transparent calc(50% + 2.5rem));
```

Source: `module-b3feda9711139b06.js`, internal module `76784`, character `28518`; serialized props `$L77`. Full machine props: `codeComponents[1]`.

## 5. Interactive components mosaic

Meaningful tree: `#components > .isolate.grid > introduction / DisclosureGroup / camera frame > blurred-mask layer + foreground layer`. Initial group is User Authentication and initial selected component is SignUp. Clicking a subitem changes the selected component. Opening a new group picks that group's first item if necessary. There is no timer advancing the selected component.

Camera: both layers pan using `MOSAIC_PAN`. For desktop, convert coordinate `[x,y]` to `[-x/720*100%, -y/602*100%]`. For phone convert `[mx,my]` to `[-mx/360*100%, -my/602*100%]`. The full ten-position map is `mosaicCamera` in the JSON. Camera must preserve both layers' identical positions.

Foreground and masked duplicate cards use `MOSAIC_FOCUS`. Newly active foreground has `.3` delay; its masked duplicate fades out with `.3` delay. Inactive foreground is opacity zero. `ScaleContainer` uses a ResizeObserver and `scale = min(containerWidth / designWidth,1)`; its readiness opacity transition is `.2 ease-out`.

Disclosure header bottom padding changes `16px -> 8px` when expanded. Panel goes from `grid-template-rows:0fr,opacity:0` to `1fr,opacity:1`, `ACCORDION`, only under `motion-safe`. Active header remains disabled so the group cannot collapse to nothing. Subitems use default color transitions, active purple-500, inactive gray-950, hovered gray-600.

Demo timeline semantics are easy to misread: each named number is the wait **before entering that named state from its preceding state**. `idle` is the initial state and its numeric value is used when looping from the last state back to idle. On pause, clear the pending timer and keep the current state. Resume waits a full next-state interval. Only the chosen visible foreground runs; mask copies and inactive cards pause. Timelines are exhaustively preserved under `stateTimelines`.

Source: `module-aaad95dadb6e50b4.js`, internal module `936378`; camera map near `201840`, root selection near `210499`. Timeline hook: `module-b3feda9711139b06.js`, internal module `50887`.

### SignUp autoplay

State waits in milliseconds:

`idle:1000, moveToEmail:1000, focusEmail:400, typingEmail:400, moveToPassword:1400, focusPassword:400, typingPassword:400, moveToSubmit:1000, clickSubmit:400, swipe:1000, swiped:700, moveToGoogle:1200, clickGoogle:1000, reset:1000`.

The cursor is centered in a full-size absolute overlay. Initial `translate3d(5rem,-1rem,0)`; email `(4rem,2rem)`; password `(3rem,7rem)`; submit `(5rem,11rem)`; swipe `(1rem,-1rem)`; provider `(3rem,-8.2rem)`; reset `(5rem,-1rem)` with an extra `.5` delay. Use CURSOR_MOVE. Focus/click events scale `[1,.85,1]` with CURSOR_CLICK.

Email and password characters are revealed by timers at `50 * characterIndex` ms. The glow swipe transforms from `skewX(-45deg) translateX(-300%)` to `skewX(-45deg) translateX(600%)`, `1.75` duration and `.3` delay. Reset repeats that wipe with duration `1.75` and `ease:'easeOut'`.

Source: same module, timeline variable `ed` at `110827`; cursor at `124201`. Exact per-field ring, text, submit, provider, and swipe motions are the corresponding `Components mosaic.elements` source records.

### SignIn autoplay

State waits: `idle:1000, moveToInput:1000, focusInput:400, typing:400, moveToSubmit:1400, clickSubmit:400, swipe:1000, swiped:700, moveToGoogle:1200, clickGoogle:1000, reset:1000`.

Cursor initial `(2.5rem,2.5rem)`, input `(4rem,6rem)`, submit `(3rem,10rem)`, swipe `(2.5rem,2.5rem)`, provider `(3rem,-4.5rem)`, reset initial with `.5` delay. Typing is `50ms` per character. Same cursor move/click constants. Source timeline `en` at `99297`, cursor at `110154`.

### Other selectable demos

All exact sequences are in `stateTimelines`; variable-to-component mapping is:

| Variable | Demo |
|---|---|
| `j` | CreateOrganization |
| `F` | OrganizationList |
| `V` | OrganizationProfile |
| `P` | OrganizationProfile Billing |
| `K` | OrganizationSwitcher |
| `et` | PricingTable |
| `ep` | UserButton |
| `eC` | UserProfile |
| `eb` | UserProfile Billing |
| `eM` | Waitlist |

Waitlist states are `idle:1000,moveToInput:1000,focusInput:400,typing:400,moveToSubmit:1400,clickSubmit:400,success:400,end:2600,reset:200`. Its success heading has a zero-bounce `.4` spring delayed `.35`; body delay `.45`. The form exits at `y:24,scale:.96,opacity:0`, zero-bounce `.3` spring; reset is `y:0,scale:1,opacity:1`, zero-bounce `.6` spring delayed `.3`.

## 6. Feature-card activation protocol

All dark authentication and light multi-tenancy cards use `HoverAnimationGroup`. On a `(hover:hover) and (pointer:fine)` device they activate only under pointer hover. On touch, full-card intersection (`amount:'all'`) registers cards in an autoplay group; the first fully visible card starts and `onComplete` advances to the next registered card, wrapping at the end. A manual hover disables that automatic cycling for the group. Unregistering an active card picks the next available registered card.

Source: `module-b3feda9711139b06.js`, internal module `478734`, character `19771`. This is not `whileInView` for every card at once.

### Authentication cards

| Card | Exact principal motion | Completion |
|---|---|---|
| MFA | `[data-border]` scale `1.5,.9,1`, `.3`, opacity `.1`, cubic `[.7,0,.3,1]`; cursor scale `1.75 -> 1`; advance six slots in `44px` steps; intermediate sequence default `.15`; active-dot opacity/scale `.1` at `+0.1` | Sequence callback |
| Fraud prevention | Spinner rotates `360deg` every `2` linear while active, resets to `0` in `.5` custom expo-out; rows stagger `.2 * index + .25`; red/orange Meteor repeats `3000ms` | `2000ms` |
| Advanced security | Drawing progress `0 -> 1`, `.75`, `[.25,.75,0,1]`; side connections `x:±5.1875rem -> 0`, `.8` delayed `.8`, custom expo-out; center highlight `.5`, `[0,.4,.2,1]`; outer glow opacity `[.6,1,.6]`, `2`, `[.7,0,.3,1]`, infinite | `2000ms` |
| Session management | Laptop panel `rotateX(-75deg) -> rotateX(20deg)` with centered x, `1`, custom expo-in-out; screen background `.5`; detail labels x `5.45/5.25/5.15rem -> 0`, `.6`, delays `0/.05/.1`; values blur `8 -> 0px` and opacity `0 -> 1`, `.6`, delays `.2/.25/.3` | `2000ms` |
| Social sign-on | Provider logos step through six curve positions, `1.2`, `[.7,0,.3,1]`; two side Meteor paths repeat `2800ms`, center `1400ms`; Meteor beginning calls advance logo position | Preserve source callback |
| Bot detection | Radar fades to `.2` in `1`; old dots fade to `0` in `1`; dot positions teleport with `top/left` duration `0`, then fade in over `1`; reticle translates and spotlight rotates in `.8`, `[.7,0,.3,1]`; active dot fades `.15`, repositions `.01`, reappears after `.2` | `4000ms` |
| Email and SMS | Main object y `0 -> -2rem`, scale `.98 -> 1`, `.5`; message y `-6.5rem -> 0`, scale `.9 -> 1`, opacity `.5 -> 1`, blur `2 -> 0px`, spring `.6`, bounce `.2`, delay `.2`; bottom object y `0 -> 2rem` | `2000ms` |
| Magic links | Link scan lasts `3 linear`; wipe x `-110% -> 10%`; highlight opacity times `[0,.2/3,2.6/3,1]`; token string updates at `200ms` intervals; path reveal `3` and `2.7` delayed `.2`; icon rotation `-45 -> 0deg`, opacity `0 -> 1`, `1` delayed `.5`, `[.7,0,.3,1]` | Source sequence callbacks |
| Passwords | Form y `0 -> -2rem` in `1` custom expo-out; characters opacity/blur reveal `1`, delay `.1 * index + .75`; lock rotations start after `2`, duration `1` custom expo-in-out, return `.5` custom expo-out | `3800ms` |
| API keys | Primary diagram `y:-50 -> -30`, `.4` custom expo-out; meter width `0 -> .95rem`, `2.2` custom expo-in-out; active cloud spinner `2 linear`; additional Meteor wiring and LED timers in source records | `2000ms` |
| CLI illustration | Progress `.75`, `[.25,.75,0,1]`; start logo timer after `550ms`, then advance every `1350ms`; provider motion `1`, `[.7,0,.3,1]`; active icon opacity `.2 linear`; highlight x/y `-4rem -> 0`, `.5`, `[0,.4,.2,1]` | `2000ms` |

Primary source: `module-10d6779b990e23ed.js`, internal ids are recorded for each named JSON section. Fraud uses `module-b3feda9711139b06.js`, internal `555385`. `controlEffects` preserves the complete imperative MFA and Bot sequences, including their actual selectors and cancellation behavior. Do not replace these with idle generic floating loops.

### Multi-tenancy cards

- Custom roles: center the active pill using `x = -(pill.offsetLeft - trackWidth/2 + pillWidth/2)`. Track transition `.75, ease:'anticipate'`. Active pill backdrop uses `.65, ease:'anticipate',delay:.125`. Active role advances immediately and every `2000ms` while active; cycle through Administrator, Engineer, Product Member, Marketing. Completion is reported after the third advance.
- Auto-join: four concentric circles scale `[1,1.1,1]`, duration `3`, custom expo-in-out, infinite, delays `0/.2/.4/.6`; return scale `1` over `1.5` custom expo-out. Three Meteor branches repeat every `3000ms`, offsets `0/1000/2000`; arrivals select organization 3/2/1 and pulse opacity `[.25,.6,.25]` over `.5`. Avatar group opacity uses `1` CSS transition.
- Invitations: three rings expand from `scaleX(1) scaleY(1)` to `scaleX(1.75) scaleY(2.5)` and opacity `1 -> 0`, duration `5`, delays `5 * index / 3`, infinite. Meteor wire repeats every `3000ms`. Completion at `5000ms`; leave resets rings in `.25`.
- Organization UI components: popover moves from opacity `0`, scale `.95`, blur `8px` to opacity `1`, scale `1`, blur `0px`; enter `1`, leave `.5`, both custom expo-out. Completion at `3000ms`.

Source: same large module, internal ids `767384`, `221480`, `24420`, `519668` respectively. All exact `initial/animate/transition` expressions are copied into JSON.

## 7. Billing demo

Billing runs only while its root is in view. Timers retain the current state when paused. The timer sequence is:

`idle:1000, moveToGetStarted:1000, clickGetStarted:600, checkout:500, moveToPay:1000, clickPay:600, success:500, moveToClose:2500, closeCheckout:600, end:1200`.

Buttons depress `translateY(0px) -> 1px -> 0px` over `.3`. Hover overlay appears after `.25`, duration `.15`. Checkout opens with opacity `[0,1]`; close fades `[1,0]` over `.3` delayed `.6`. Success center scale `.9 -> 1` and opacity `0 -> 1`, spring bounce `.2`, delay `.2`; four success rings have widths `87/147/215/287px` and spring delays `.2 + (index+1)*.1`.

The blurred background has two concurrent authored rotation definitions on the same element: CSS `spin 12s linear infinite`, plus Motion transform `rotate(-90deg) -> rotate(45deg)`, duration `4`, infinite, reverse. Preserve both authored definitions. The observed computed capture records the CSS spin.

Source: `module-51a8b1f485d5975d.js`, internal `548010`; timeline around `3960`, glow around `11700`. JSON section `Billing demo` and state timeline `c`.

## 8. Framework cards

Each framework card has a colored animated dot field that mounts on hover. A group increments its shared z index each time a card enters. Border/z-index leave duration `.15` delayed `.15`; enter duration `.3`, delay `0`. Keyboard focus fixes the focus z index and disables border transition.

Logo container starts `translateY(16px)`, reaches `0` in `.3`. Outline image fades opacity `1 -> 0` and colored image `0 -> 1`, both `.5`. Label opacity `0 -> 1` in `.3`, delay `.075` on hover/focus. `no-hover` devices show the label and unshifted icon in the resting state.

Source: `module-98643b5f1c1dec6a.js`, internal `883499`, logo definitions around `20679`; CSS computed entries `138` through `185`. Dot shader settings are supplied by `DotsHoverBlock` and should be preserved from its module, rather than simulated with a CSS scale effect.

## 9. Quotes and testimonial tickers

QuoteCarousel rotates every `7000ms`, regardless of section scroll position. Initial is false. Transition is `QUOTE`.

Active quote: opacity `1`; mask-position `0px 0px -> -1200px 0px`; blur `4px -> 0px`; scale `.98 -> 1`; skewY `1 -> 0`; rotation `-1 -> 0` degrees. Inactive quote: opacity `1`; mask-position `-3200px 0px -> -4600px 0px`; blur `4px`; scale `1.02`; skewY `-1`; rotation `1`. It hides by its moving mask rather than setting opacity to zero. Mask size is `4000px 304px`, linear gradient angle `-40deg` with stops `0,13.5,27,72,77.4,100%`.

Two testimonial columns use native Motion Ticker:

| Column | Velocity | Visibility | Gap | Hover |
|---|---:|---|---:|---|
| First | `25px/s`, upward | All widths | `16px` | Animate multiplier to `0` |
| Second | `-35px/s`, downward | `lg` and above | `16px` | Animate multiplier to `0` |

`axis:'y'`, `align:'stretch'`. Update `offset -= deltaMs/1000 * velocity * multiplier`; wrap between `-totalItemLength-gap-inset` and `-inset`. The lists clone enough rows to cover the viewport. They run within `100px` of view, pause when the document is hidden, and stop automatic movement under reduced motion. Hover deceleration and resume call Motion `animate` with no explicit transition. Keep the library default instead of inventing a new easing. Keyboard focus enters a static focus mode. There is no drag behavior.

Card hover changes background and shadow over `.2`, CSS ease-in-out `[.4,0,.2,1]`. Full light/dark shadow strings are in `cssInteractionInventory`.

Source: `module-5f4639cc5ff32d01.js`, internal `881872` for quotes and `475403` for ticker. Exact ticker props are serialized as `$L97` in `dom/full.html`.

## 10. Footer and fixed support

Footer links transition `gray-950 -> gray-700`, `.15`, `[.4,0,.2,1]`. The fixed support launcher uses CTA and a sheen opacity `.5 -> 1`. It has no continuous idle pulse in the captured DOM. No footer entrance animation is specified.

## 11. CSS keyframes and implementation checks

Only `spin` is confirmed as a mounted CSS keyframe animation in the homepage capture. The stylesheet also defines these reusable keyframes, which must not be attached to extra elements without a source usage:

```css
@keyframes fade-in { 0% { opacity:var(--fade-in-from,0) } to { opacity:var(--fade-in-to,1) } }
@keyframes letter-reveal { 0% { opacity:0; filter:blur(2px) } to { opacity:1; filter:blur() } }
@keyframes blink { 0%,to { opacity:1 } 50% { opacity:0 } }
@keyframes float { 0%,to { translate:0 } 50% { translate:0 var(--float-distance,-.75rem) } }
@keyframes spin { to { transform:rotate(360deg) } }
@keyframes pulse { 50% { opacity:.5 } }
```

Implementation checks:

1. Hero paths move independently and restart when their in-view canvases remount; neither heading nor full page waits for a preloader.
2. All four logo columns step vertically, with their own initial delays and the same pause cadence.
3. Selecting a component moves both camera layers together; only selected foreground autoplay runs.
4. Hovering a feature starts its specific diagram; touch visibility runs one registered card at a time.
5. Framework logos reveal color and names without moving the tile box.
6. Testimonial columns travel opposite directions and smoothly pause under pointer hover.
7. Use the exact recorded custom functions for expo feature easing. A same-named library easing is a different curve.
8. Do not treat `76.65075748523496ms` CDP CSS events as a design constant. They are shortened interrupted transitions; the authored base remains `.3`.

### Additional exact shader and easing details

Email and SMS uses its own local exponential easing, `t === 1 ? 1 : 1 - 2 ** (-8 * t)`, in `module-10d6779b990e23ed.js`, internal module 127528, character 377183. This must not resolve to the shared exponent-10 easing. The machine-readable key is `EMAIL_EXPO_OUT`.

Framework hover fields use `Dots` from `module-c6b6dbe4d8f8d433.js`, internal modules 37288 and 728107. The canvas runs WebGL2 at 30fps, pixel ratio rounded after clamping to 1 through 2, with `SRC_ALPHA, ONE` blending and depth testing disabled. Its 3px grid has 1px dots, centered horizontally only. The exact random function is `fract(tan(distance(xy * 1.61803398874989484820459, xy) * 0.5) * xy.x)`. Intro delay is distance from grid center times .01 plus random times .15 seconds. The reveal applies a 1.25 intensity flash for .1 seconds after each dot appears. Random opacity refresh frequency is 5 seconds. All uniform values, per-framework palettes, vertex resolution mapping, and shader expressions are under `codeComponents["Framework hover dots"]` in `transitions.json`. Hover mounts the canvas; exit opacity uses the runtime default before removal.
