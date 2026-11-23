# 3 FOR ALL — Hockey Practice

Welcome to Phylers Culture. Pick #24 in white, #11 in black, or #39 in orange. The other two skaters compete as independent AI rivals. All three shoot on the same goalie.

## Practice modes

- Pick #24 or #11 for the three-minute competition. The skater with the most goals wins, and ties share a place in the final standings.
- Pick #39 for a race where the first skater to five goals wins. After your fourth goal, the general manager sends #39 back to Russia, and you take over #44. He carries your four goals into the rest of the race.

## Run locally

From the project directory, start a static server and open `http://localhost:8000` in a browser.

```sh
python3 -m http.server 8000
```

There is no package installation or build step. Use a static server because the game loads JavaScript modules. All the assets ship with the game.

## Controls

| Action | Keyboard | Touchscreen |
| --- | --- | --- |
| Skate | WASD or arrow keys | Drag the left joystick |
| Shoot | Space | Shoot |
| Poke check | J | Poke |
| Body check | K | Check |
| Skate boost | Hold Shift | Hold Boost |
| Special | L | Special |
| Pause | Esc | Pause |

Skate toward the net to aim. Shoot while skating diagonally to target that side of the goal. Poke the puck away with your stick or close the gap for a body check. Follow shots for rebounds. On a tablet, rotate to landscape and steer with your left thumb while using the action buttons with your right. Settings offers three difficulty levels, sound, and fullscreen where the browser supports it.

## Special moves

Each skater has a charge meter on the scoreboard.

- #24 lands the hardest body checks and has a weaker regular shot. With a full meter and the puck on your stick, use Special to burst past a defender.
- #11 is the fastest skater. Use Special with the puck and a full meter to wind up a heavy slapshot.
- #39 skates a little slower and can sometimes hold the puck through a check. For a Michigan, use Special with a full meter and the puck to lift it, then press Shoot to throw it at the net.
- #44 is a tall, slow, left-handed skater with a weak shot. His charged Wobbly Shot uses the Special button.

Watch the bench for the coach’s protein shakes, which can knock #39 down. When #39 scores, the other two have something to say about it. The orange mascot stays outside the boards and returns skaters who get checked out of the rink.

## Publish on GitHub Pages

1. Copy the contents of this project into the root of your GitHub repository. Keep `index.html`, `style.css`, `src/`, `assets/`, and `.nojekyll` together. Commit and push the files to `main` or your chosen publishing branch.
2. In the repository, open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select the publishing branch and **/ (root)**, then click **Save**.
4. Open the address shown in **Settings → Pages** after deployment finishes. A project repository normally publishes at `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`.

The game uses relative file paths so it can run under the repository path or at a domain root.

## Project structure

| File | Responsibility |
| --- | --- |
| `index.html`, `style.css` | Game shell, scoreboard, menus, and responsive layout |
| `src/game.mjs` | Game rules, rink geometry, puck physics, scoring, specials, and AI |
| `src/render.mjs` | Canvas 2D rink, bench, sprites, and effects |
| `src/input.mjs` | Keyboard and multitouch controls |
| `src/audio.mjs` | Procedural Web Audio effects |
| `src/coach.mjs` | Coach dialogue, gestures, and timing |
| `src/main.mjs` | App state, rendering loop, and simulation events |

Artwork is drawn in Canvas. Barlow fonts are distributed under the [SIL Open Font License](assets/OFL-Barlow.txt). The sound effects are generated in the browser.

## Run the tests

The tests use Node.js 20 or later and the built-in Node test runner.

```sh
node --test
```

The automated tests cover skater selection, the timed and race modes, #39’s substitution and manual Michigan, the special moves, puck battles, goalie rebounds, mascot returns, protein-shake impacts, and coach dialogue timing.
