import * as vscode from "vscode";
import GitHubServce from "./service/github";

const statusBarIcon = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Left
);
statusBarIcon.text = "$(pulse) Sending to GitHub status...";

let config = vscode.workspace.getConfiguration("githubstatus");
let interval: NodeJS.Timeout | null = null;
let gitHubService: GitHubServce;
let lang : any | null = null;

export async function activate(context: vscode.ExtensionContext) {
    // Load lang

     const gitExtension = vscode.extensions.getExtension('vscode.git');
  if (!gitExtension) {
    vscode.window.showErrorMessage('Git extension not found');
    return;
  }

  const git = await gitExtension.activate();


     const userLang = vscode.env.language || 'en';
    
    try {
        lang = require(`../langs/${userLang}.json`);
    } catch {
        lang = require('../langs/en.json');
        await handleUnsupportedLanguage(userLang, lang.unsupportedLang);
    }



  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders[0].uri.fsPath in config.get<string[]>("blacklist")!) {
    statusBarIcon.text = lang["status.blacklisted"];
    return;
  }
  const token = config.get<string>("token");
  
  gitHubService = new GitHubServce(lang, token);
  await waitForGitScanComplete(git.getAPI(1));
  statusBarIcon.show();
  if (gitHubService.received && vscode.workspace.name) {
    interval = await gitHubService.updateStatus(vscode.workspace.name);
  }
  statusBarIcon.text = lang["status.synced"];
  statusBarIcon.command = "githubstatus.deactivate";
  statusBarIcon.tooltip = lang["status.synced.tooltip"];
  try {


    let disposable = vscode.commands.registerCommand(
      "githubstatus.createToken",
      async () => {
        try {
          const info = await vscode.window.showInformationMessage(
            lang["tokenNeeded.desc"],
            { modal: true, },
            lang["tokenNeeded.title"]
          );
          if (info) {
            // Create token
            await vscode.env.openExternal(
              vscode.Uri.parse("https://github.com/settings/tokens/new?scopes=user&description=github_sync")
            );
            vscode.commands.executeCommand("githubstatus.accessToken");
          }
          console.log(info);
        } catch (err) {
          console.error(err);
        }
      }
    );
    let accessToken = vscode.commands.registerCommand(
      "githubstatus.accessToken",
      async () => {
        try {
          const newToken = await vscode.window.showInputBox({
            prompt: lang["accessToken.prompt"],
          });
          if (!newToken) {
            vscode.commands.executeCommand("githubstatus.accessToken");
          } else {
            await config.update("token", newToken, 1);
            vscode.commands.executeCommand("githubstatus.restart");
          }
        } catch (err) {
          console.error(err);
        }
      }
    );
    let restart = vscode.commands.registerCommand(
      "githubstatus.restart",
      () => {
        console.log("Restart");
        config = vscode.workspace.getConfiguration("githubstatus");
        activate(context);
      }
    );
    let deac = vscode.commands.registerCommand(
      "githubstatus.deactivate",
      () => {
        console.log("Deactivating");
        deactivate();
      }
    );
    context.subscriptions.push(disposable, accessToken, restart, deac);
  } catch {
    console.log("Restarted");
  }
}

export async function deactivate() {
  statusBarIcon.text = lang["status.unsynced"];
  statusBarIcon.command = "githubstatus.restart";
  statusBarIcon.tooltip = lang["status.unsynced.tooltip"];
  if (interval) {
    clearInterval(interval);
  }
  await gitHubService.setDefault();
}

async function handleUnsupportedLanguage(userLang: string, message: string) {
    const encodedMessage = encodeURIComponent(message);
    const googleTranslateUrl = `https://translate.google.com/?sl=en&tl=${userLang}&text=${encodedMessage}&op=translate`;

    if(config.get<boolean>("notsupportedlang")){
      return;
    }

    const selection = await vscode.window.showErrorMessage(
        message,
        { modal: true },
        'Translate with Google'
    );

    if (selection === 'Translate with Google') {
        await vscode.env.openExternal(vscode.Uri.parse(googleTranslateUrl));
        await delay(2500); // wait 5 seconds before continuing
    }

    config.update("notsupportedlang", true);
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function waitForGitScanComplete(gitAPI: any): Promise<void> {

  const prevInit = vscode.window.setStatusBarMessage(
      '$(sync~spin) Waiting for Git initialization…'
    );

  while (gitAPI.state === 'uninitialized') {
    await delay(1); // pause for 5ms before checking again
  }

  prevInit.dispose();

  const checkScanning =  () =>
    gitAPI.repositories.some(
      (repo: any) => repo.state.isScanning || repo.state.isRebasing
    );

  if (!checkScanning()) {
    return;
  }

  const status = vscode.window.setStatusBarMessage('$(sync~spin) Waiting for Git to finish scanning...');

  return new Promise<void>((resolve) => {
    const disposables = gitAPI.repositories.map((repo: any) =>
      repo.state.onDidChange(() => {
        if (!checkScanning()) {
          disposables.forEach((d: any) => d.dispose());
          status.dispose(); // clear the message
          resolve();
        }
      })
    );
  });
}