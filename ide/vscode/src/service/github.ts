import * as vscode from "vscode";
import { graphql as gitHubApi } from "@octokit/graphql";
import { RequestParameters, graphql } from "@octokit/graphql/dist-types/types";
import * as moment from "moment";
import { format } from "../tools/translate";
import path = require("path");

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
  constructor(__lang: any, token?: string) {
        vscode.workspace.onDidSaveTextDocument((e) => {
      this.__currentLanguage = e.languageId;
    });

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

const repos = this.__gitApi.repositories;

  if (repos.length === 1){
    const gitUrl = repos[0].state.remotes.find((r:any) => r.fetchUrl);
    if(gitUrl !== null){
      const repoName = getRepoName(gitUrl.fetchUrl);
    if(repoName !== null){
      const rawUrl = gitUrl.fetchUrl ?? ""; // from gitAPI
      const cleanUrl = rawUrl.endsWith(".git") ? rawUrl.slice(0, -4) : rawUrl;
     workspace = repoName + ` (${cleanUrl})`; // cut the last 4 letters
    }
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

  const message = format(this.lang["githubService.userStatus.full"], {
  workspace,
  language: langPart,
  diff: diffPart
});

    const status: UserStatus = {
      expiresAt: new Date(
        OFFSET + new Date().getTime() + this.__expires * 60000 * 2
      ).toISOString(),
      message: message,
      emoji,
    };
    try {
      await this.__api(changeUserStatusMutation, { request: {}, status });
    } catch (err) {
      console.error(err);
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
