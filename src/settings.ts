import { App, Notice, PluginSettingTab, Setting, requireApiVersion } from "obsidian";
import type {
  SettingDefinitionControl,
  SettingDefinitionItem,
  SettingDefinitionList,
} from "obsidian";
import { DEFAULT_SETTINGS } from "./config";
import type WayfinderPlugin from "./main";

const TOKEN_DESCRIPTION =
  "Fine-grained personal access token with read-only Issues permission for the repo. " +
  "Create one at github.com → Settings → Developer settings → Fine-grained tokens. " +
  "Stored in plain text in this vault's plugin data.";

export class WayfinderSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: WayfinderPlugin) {
    super(app, plugin);
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const repos: SettingDefinitionList = {
      type: "list",
      heading: "Repositories",
      emptyState: "No repositories configured yet.",
      addItem: {
        name: "Add repository",
        action: () => {
          this.plugin.settings.repos.push({ repo: "", token: "" });
          void this.plugin.saveSettings();
          if (requireApiVersion("1.13.0")) this.update();
        },
      },
      onDelete: (index) => {
        this.plugin.settings.repos.splice(index, 1);
        void this.plugin.saveSettings();
        if (requireApiVersion("1.13.0")) this.update();
      },
      items: this.plugin.settings.repos.map((config) => ({
        name: config.repo || "New repository",
        desc: TOKEN_DESCRIPTION,
        searchable: false,
        render: (setting) => {
          setting
            .addText((text) =>
              text
                .setPlaceholder("owner/name")
                .setValue(config.repo)
                .onChange(async (value) => {
                  config.repo = value.trim();
                  await this.plugin.saveSettings();
                }),
            )
            .addText((text) => {
              text
                .setPlaceholder("github_pat_…")
                .setValue(config.token)
                .onChange(async (value) => {
                  config.token = value.trim();
                  await this.plugin.saveSettings();
                });
              text.inputEl.type = "password";
              text.inputEl.addClass("wf-token-input");
            })
            .addButton((button) =>
              button.setButtonText("Test connection").onClick(async () => {
                try {
                  const fullName = await this.plugin.testConnection(config);
                  new Notice(`Connected: ${fullName} — issues readable`);
                } catch (e) {
                  new Notice(e instanceof Error ? e.message : String(e));
                }
              }),
            );
        },
      })),
    };
    const syncInterval: SettingDefinitionControl = {
      name: "Sync interval (minutes)",
      desc: "How often the view re-syncs while it is open. Manual refresh is always available.",
      control: {
        type: "number",
        key: "pollIntervalMinutes",
        min: 0.5,
        max: 120,
      },
    };
    const copyTemplate: SettingDefinitionControl = {
      name: "Copy template",
      desc: "What clicking a ticket copies. {url} is replaced with the issue URL.",
      control: {
        type: "text",
        key: "copyTemplate",
        defaultValue: DEFAULT_SETTINGS.copyTemplate,
      },
    };
    return [repos, syncInterval, copyTemplate];
  }

  /** Fallback for Obsidian < 1.13, where getSettingDefinitions() is never called. */
  display(): void {
    this.renderImperative();
  }

  private renderImperative(): void {
    const { containerEl } = this;
    containerEl.empty();

    this.plugin.settings.repos.forEach((config, index) => {
      new Setting(containerEl)
        .setName(`Repository ${index + 1}`)
        .setDesc("owner/name of the repo holding the wayfinder maps.")
        .addText((text) =>
          text
            .setPlaceholder("owner/name")
            .setValue(config.repo)
            .onChange(async (value) => {
              config.repo = value.trim();
              await this.plugin.saveSettings();
            }),
        );

      new Setting(containerEl).setName("GitHub token").setDesc(TOKEN_DESCRIPTION).addText((text) => {
        text
          .setPlaceholder("github_pat_…")
          .setValue(config.token)
          .onChange(async (value) => {
            config.token = value.trim();
            await this.plugin.saveSettings();
          });
        text.inputEl.type = "password";
        text.inputEl.addClass("wf-token-input");
      });

      new Setting(containerEl)
        .setName("Repository actions")
        .setDesc("Check access or remove this repository.")
        .addButton((button) =>
          button.setButtonText("Test connection").onClick(async () => {
            try {
              const fullName = await this.plugin.testConnection(config);
              new Notice(`Connected: ${fullName} — issues readable`);
            } catch (e) {
              new Notice(e instanceof Error ? e.message : String(e));
            }
          }),
        )
        .addButton((button) =>
          button.setButtonText("Remove").onClick(async () => {
            this.plugin.settings.repos.splice(index, 1);
            await this.plugin.saveSettings();
            this.renderImperative();
          }),
        );
    });

    new Setting(containerEl)
      .setName("Repositories")
      .setDesc("Sync another repository into the combined Wayfinder view.")
      .addButton((button) =>
        button.setButtonText("Add repository").onClick(async () => {
          this.plugin.settings.repos.push({ repo: "", token: "" });
          await this.plugin.saveSettings();
          this.renderImperative();
        }),
      );

    new Setting(containerEl)
      .setName("Sync interval (minutes)")
      .setDesc("How often the view re-syncs while it is open. Manual refresh is always available.")
      .addText((text) =>
        text.setValue(String(this.plugin.settings.pollIntervalMinutes)).onChange(async (value) => {
          const n = Number(value);
          if (Number.isFinite(n)) {
            this.plugin.settings.pollIntervalMinutes = Math.min(120, Math.max(0.5, n));
            await this.plugin.saveSettings();
          }
        }),
      );

    new Setting(containerEl)
      .setName("Copy template")
      .setDesc("What clicking a ticket copies. {url} is replaced with the issue URL.")
      .addText((text) =>
        text.setValue(this.plugin.settings.copyTemplate).onChange(async (value) => {
          this.plugin.settings.copyTemplate = value || DEFAULT_SETTINGS.copyTemplate;
          await this.plugin.saveSettings();
        }),
      );
  }

  getControlValue(key: string): unknown {
    return this.plugin.settings[key as keyof typeof this.plugin.settings];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    if (key === "pollIntervalMinutes") {
      const n = Number(value);
      if (!Number.isFinite(n)) return;
      this.plugin.settings.pollIntervalMinutes = Math.min(120, Math.max(0.5, n));
    } else if (key === "copyTemplate" && typeof value === "string") {
      this.plugin.settings.copyTemplate = value || DEFAULT_SETTINGS.copyTemplate;
    } else {
      return;
    }
    await this.plugin.saveSettings();
  }
}
