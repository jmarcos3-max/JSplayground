/** One-time Monaco JS defaults + Audiotool playground .d.ts stub. */
export function installPlaygroundIntellisense(monaco) {
  if (window.__AUDIOTOOL_INTELLISENSE_LOADED__) return;
  window.__AUDIOTOOL_INTELLISENSE_LOADED__ = true;

  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    allowNonTsExtensions: true,
    checkJs: true,
    target: monaco.languages.typescript.ScriptTarget.ES2022,
  });

  monaco.languages.typescript.javascriptDefaults.addExtraLib(
    `
    declare const nexus: {
      modify: <T>(callback: (t: Transaction) => Promise<T> | T) => Promise<T>;
      queryEntities: any;
      events: {
        onUpdate(field: any, listener: (value: any) => void): void;
        onCreate(
          entityType: string,
          listener: (entity: any) => void | (() => void)
        ): void;
      };
    };

    declare const client: {
      api: {
        projectService: {
          listProjects: (req: any) => Promise<any>;
          createProject: (req: { project?: { displayName?: string } }) => Promise<any>;
        };
        sampleService: {
          /** Keyword search uses "textSearch"; response has "samples", not "items". */
          listSamples: (req: {
            pageSize?: number;
            pageToken?: string;
            filter?: string;
            orderBy?: string;
            textSearch?: string;
          }) => Promise<{ samples?: unknown[]; nextPageToken?: string }>;
        };
        userService: any;
      };
    } | null;

    declare interface Transaction {
      create(
        type:
          | "heisenberg"
          | "tonematrix"
          | "machiniste"
          | "bassline"
          | "stompboxDelay"
          | "desktopAudioCable"
          | "desktopNoteCable",
        config: {
          positionX?: number;
          positionY?: number;
          displayName?: string;
          gain?: number;
          mix?: number;
          feedbackFactor?: number;
          fromSocket?: any;
          toSocket?: any;
          [key: string]: any;
        }
      ): any;
      update(field: any, value: any): void;
    }
  `,
    "audiotool-playground-intellisense.d.ts",
  );
}
