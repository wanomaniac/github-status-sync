# Github Status Synchronizer for VSCode
## Based off [ericm's github status extension](https://github.com/ericm/vscode-github-status/tree/master)
It will synchronize your git repo to your GitHub status!

## How to get started
When installing this extension, it will notify you to create a token, which will open an external tab which has the token creation properties filled for you. Ensure that the expiration date is something you can work with, but don't fret, if it does expire, the extension will let you know when it does and ask for a new token.

Once, the token has successfully worked, no need to do anything, thats all.

## Version History
### 1.0.2-STABLE
- Major changes when it comes to privacy, you will now be notified when a private repo you are working on is detected to be synchronized, you can make a choice if you want to hide it.
- Bug fixes 
- More lingual text options

### 1.0.1-STABLE
- Minor bug fixes related to fetch urls

## Extension Settings
I plan on adding more privacy orientated features (like hiding github links, etc)

This extension contributes the following settings:

- `githubstatus.token`: GitHub User Access Token
- `githubstatus.interval`: Refresh interval / Expiry time for GitHub Status (in minutes)
- `githubstatus.default`: Default status message to set your profile to upon closing of the application.
- `githubstatus.blacklist`: Blacklist of workspace paths that won't be synced
- `githubstatus.emoji`: Emoji used for status. See [this gist](https://gist.github.com/rxaviers/7360908) for full list of options
- `githubstatus.emojiDefault`: Emoji used for default status. See [this gist](https://gist.github.com/rxaviers/7360908) for full list of options
