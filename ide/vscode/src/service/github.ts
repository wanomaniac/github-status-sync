import * as vscode from "vscode";
import { graphql as gitHubApi } from "@octokit/graphql";
import { RequestParameters, graphql } from "@octokit/graphql/dist-types/types";
import * as moment from "moment";
import { format } from "../tools/translate";
import path = require("path");
import fetch from "node-fetch";

interface IEnv {
  [key: string]: string | undefined;
}

const OFFSET = 10000;

const changeUserStatusMutation = `
  mutation ($status: ChangeUserStatusInput!) {
    changeUserStatus(input: $status) {
      status {
        emoji
        expiresAt
        limitedAvailability: indicatesLimitedAvailability
        message
      }
    }
  }
`;

export default class {
  private lang : any | null = null;
  private __api: graphql;
  private __expires = 1;
  private __start?: moment.Moment;
  private __currentLanguage?: string;
  private __gitApi : any;
  public received = false;
  private isHidden = false;
  private dontAlertPrivacy = false;
  private statusB : vscode.StatusBarItem;

  private state: "Updated" | "Updating" | "WaitingUserInput" | "Offline" | "Error" = "Offline";

  private updateStatusState(newState: "Updated" | "Updating" | "WaitingUserInput" | "Offline" | "Error", message?: string) {
    this.state = newState;
    switch (newState) {
      case "Updated":
        this.statusB.text = `$(check) ${this.lang["status.synced"]}`;
        this.statusB.tooltip = message || this.lang["status.synced.tooltip"];
        this.statusB.command = "githubstatus.deactivate";
        this.statusB.color = undefined;
        break;
      case "Updating":
        this.statusB.text = `$(sync~spin) ${this.lang["status.syncing"]}`;
        this.statusB.tooltip = message || this.lang["status.syncing.tip"];
        this.statusB.command = undefined;
        this.statusB.color = undefined;
        break;
      case "WaitingUserInput":
        this.statusB.text = `$(question) ${this.lang["status.userInput"]}`;
        this.statusB.tooltip = message || this.lang["status.userInput.tooltip"];
         this.statusB.command = undefined;
        this.statusB.color = "#FFA500";
        break;
      case "Offline":
        this.statusB.text = `$(cloud-off) ${this.lang["status.offline"]}`;
        this.statusB.tooltip = this.lang["status.offline.tooltip"];
         this.statusB.command = "githubstatus.retrystatus";
        this.statusB.color = "#888888";
        break;
      case "Error":
        this.statusB.text = `$(error) ${this.lang["status.error"]}`;
        this.statusB.tooltip = message;
        this.statusB.color = "#FF0000";
       this.statusB.command = undefined;
        break;
    }
    this.statusB.show();
  }

  constructor(__lang: any, statusButton: vscode.StatusBarItem, token?: string) {
        vscode.workspace.onDidSaveTextDocument((e) => {
      this.__currentLanguage = e.languageId;
    });

    this.statusB = statusButton;
    this.lang = __lang;

      const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
      this.__gitApi = gitExtension?.getAPI(1);

    const config: RequestParameters = {};

    this.__expires =
      ((vscode.workspace.getConfiguration("githubstatus").get("interval") as number) ?? 2) / 2 || 1;

    if (token) {
      this.received = true;
      config.headers = { authorization: `token ${token}` };
    } else {
      // Get token
      vscode.commands.executeCommand("githubstatus.createToken");
    }
    this.__api = gitHubApi.defaults(config);


  }

  public async updateStatus(workspace: string): Promise<NodeJS.Timeout | null> {
      this.updateStatusState("Updating");
const repos = this.__gitApi.repositories;

if(repos.length > 0){

const gitUrl = repos[0].state.remotes.find((r:any) => r.fetchUrl);

if(gitUrl){

 const repoName = getRepoName(gitUrl.fetchUrl);
  const blDatabase = vscode.workspace.getConfiguration("githubstatus").get("blacklist") as Array<string>;

if(this.isHidden){
  // check if not blacklisted
     if(blDatabase.find((data) => data.includes(repoName!)) === undefined){ // no longer blacklisted
        this.isHidden = false;
     }
} else {
  // check if blacklisted
  //   const blDatabase = vscode.workspace.getConfiguration("githubstatus").get("blacklist") as Array<string>;
     const blData = blDatabase.find((data) => data.includes(repoName!));
     if(blData !== undefined){ // blacklisted
        this.isHidden = true;
        if(blData.includes("%private%")){
          // confirm if it is still private, otherwise, turn it public.
           const fetchUrl = gitUrl.fetchUrl;
          // Convert SSH to HTTPS if needed
          let apiUrl = fetchUrl;
          if (fetchUrl.startsWith("git@github.com:")) {
        apiUrl = "https://github.com/" + fetchUrl.replace("git@github.com:", "").replace(/\.git$/, "");
          } else if (fetchUrl.startsWith("https://github.com/")) {
        apiUrl = fetchUrl.replace(/\.git$/, "");
          }
          // GitHub API for repo info
          const repoApiUrl = apiUrl.replace("https://github.com/", "https://api.github.com/repos/");
          const res = await fetch(repoApiUrl, { method: "GET" });
          if (res.status !== 404) {
            // Remove the element from the array
            const index = blDatabase.indexOf(blData);
            if (index > -1) {
              blDatabase.splice(index, 1);
              await vscode.workspace.getConfiguration("githubstatus").update("blacklist", blDatabase, vscode.ConfigurationTarget.Global);
            }
            this.isHidden = false;
          }
        }
     }
}


       
        // GET the repo fetchURL to see if its public, if 404, then its not public, send a warning prompt saying this github project is not public, do you want to hide the details
        try {
          if(!this.isHidden && !this.dontAlertPrivacy){
          const fetchUrl = gitUrl.fetchUrl;
          // Convert SSH to HTTPS if needed
          let apiUrl = fetchUrl;
          if (fetchUrl.startsWith("git@github.com:")) {
        apiUrl = "https://github.com/" + fetchUrl.replace("git@github.com:", "").replace(/\.git$/, "");
          } else if (fetchUrl.startsWith("https://github.com/")) {
        apiUrl = fetchUrl.replace(/\.git$/, "");
          }
          // GitHub API for repo info
          const repoApiUrl = apiUrl.replace("https://github.com/", "https://api.github.com/repos/");
          const res = await fetch(repoApiUrl, { method: "GET" });
          if (res.status === 404) {
        this.updateStatusState("WaitingUserInput");
        const hide = await vscode.window.showWarningMessage(
          this.lang["githubService.repo.hide"],
          this.lang["githubService.repo.hide.yes"], this.lang["githubService.repo.hide.no"]
        );

  this.updateStatusState("Updating");

        if (hide === this.lang["githubService.repo.hide.yes"]) {
          vscode.window.showInformationMessage(this.lang["githubService.repo.hidden_now"]);
         blDatabase.push(`%private%${repoName}`); // %private 
         await vscode.workspace.getConfiguration("githubstatus").update("blacklist", blDatabase, vscode.ConfigurationTarget.Global);
          this.isHidden = true;
        } else {
            this.dontAlertPrivacy = true;
        }
          }
          }
        } catch (err) {
          vscode.window.showWarningMessage(this.lang["githubService.repo.failed_visibilty"]);
        }

        if(!this.isHidden){
    if(repoName !== null){
      const rawUrl = gitUrl.fetchUrl ?? ""; // from gitAPI
      let cleanUrl = rawUrl.endsWith(".git") ? rawUrl.slice(0, -4) : rawUrl;
      cleanUrl = cleanUrl.replace("https://github.com/", ""); // Since GitHub statuses are only on github, adding github.com is pointless.
     workspace = cleanUrl; // I've decided from the status being working on [status] (link) to just working on [cut link] for easier work.
    }
  } else {
      workspace = this.lang["githubService.repo.private"];
  }
} else {
   vscode.window.showErrorMessage(this.lang["githubService.repo.nourl"]);
}

  }
  

    

    const emoji = vscode.workspace
      .getConfiguration("githubstatus")
      .get("emoji") as Emoji;
    const time = moment(new Date());
    let diff = "";
    let interval: NodeJS.Timeout | null = null;
    if (!this.__start) {
      this.__start = time;
      interval = setInterval(
        () => this.updateStatus(workspace),
        this.__expires * 60000
      );
    } else {
      let diffN = Math.floor(time.diff(this.__start, "minutes"));
      diff = `${diffN} minute${diffN > 1 ? "s" : ""}`;
      if (diffN > 60) {
        const hours = Math.floor(diffN / 60);
        const minutes = Math.floor(diffN % 60);
        console.log(diffN, time.diff(this.__start, "minutes"), hours, minutes);
        diff = `${hours} hour${hours > 1 ? "s" : ""} ${minutes} minute${
          minutes > 1 ? "s" : ""
        }`;
      }
    }

    const langPart = this.__currentLanguage
  ? format(this.lang["githubService.userStatus.languange"], { language: this.__currentLanguage })
  : "";

  const diffPart = diff.length > 0
  ? format(this.lang["githubService.userStatus.diff"], { diff })
  : "";

  let message = format(this.lang["githubService.userStatus.full"], {
  workspace,
  language: langPart,
  diff: diffPart
});

if(message.length > 80){
  vscode.window.showWarningMessage(this.lang["githubService.char_limit"]);
  message = message.slice(0, 80);
}

    const status: UserStatus = {
      expiresAt: new Date(
        OFFSET + new Date().getTime() + this.__expires * 60000 * 2
      ).toISOString(),
      message: message,
      emoji,
    };
    try {
      await this.__api(changeUserStatusMutation, { request: {}, status });
      this.updateStatusState("Updated");
    } catch (err) {
      // check if err is network related
      console.error(err);
      if (err && typeof err === "object" && "message" in err && typeof err.message === "string" && (
        err.message.includes("network") ||
        err.message.includes("ENOTFOUND") ||
        err.message.includes("ECONNREFUSED") ||
        err.message.includes("ECONNRESET") ||
        err.message.includes("ETIMEDOUT")
      )) {
        this.updateStatusState("Offline");
      } else {
        this.updateStatusState("Error", `${err}`);
      }
    } finally {
      return interval;
    }
  }
  public async setDefault(): Promise<void> {
    const message = vscode.workspace
      .getConfiguration("githubstatus")
      .get("default") as string;
    if (!message) {
      return;
    }
    const emoji = vscode.workspace
      .getConfiguration("githubstatus")
      .get("emojiDefault") as Emoji;
    const status: UserStatus = {
      emoji,
      message,
    };
    try {
      await this.__api(changeUserStatusMutation, { request: {}, status });
    } catch (err) {
      console.error(err);
    }
  }
}

function getRepoName(gitUrl: string) {
  // Trim and remove trailing slash
  gitUrl = gitUrl.trim().replace(/\/$/, "");

  // Extract repo name with or without .git
  const regex = /(?:github\.com[/:])([^/]+)\/([^/]+)(?:\.git)?$/;
  const match = gitUrl.match(regex);

  if (!match) {return null;}

  let repoName = match[2]; // repo name with possible '.git'

  // Just in case, explicitly strip '.git' suffix if present
  if (repoName.endsWith('.git')) {
    repoName = repoName.slice(0, -4);
  }

  return repoName.toUpperCase();
}
