Credit Claude in commits with only `Co-Authored-By: Claude <noreply@anthropic.com>`. Don't add model names or session links to commits or pull requests.

When showing work to the user for them to try or validate, build with `npm run build:playtest` and share `dist/playtest.html` (for example, published as an artifact), not the public `dist/index.html`. The playtest build lets them jump straight to the mission, fight and ships the change affects; say which ones to pick.
