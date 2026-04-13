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

    /** Legacy slot (was nexusui). Use native DOM: button, input[type=range], etc. */
    declare const Nexus: null;

    /**
     * Same as \`import { getLoginStatus } from "@audiotool/nexus"\`. Run strips that import line
     * and injects the real function from the bundle.
     */
    declare const getLoginStatus: (opts: {
      clientId: string;
      redirectUrl: string;
      scope: string;
    }) => Promise<{
      loggedIn: boolean;
      login: () => void | Promise<void>;
      logout: () => void | Promise<void>;
      getUserName?: () => Promise<string>;
    }>;

    /** Same as \`import { createAudiotoolClient } from "@audiotool/nexus"\` (injected). */
    declare const createAudiotoolClient: (opts: {
      authorization: unknown;
    }) => Promise<unknown>;

    /** @deprecated Use \`getLoginStatus\` — alias for older playground snippets. */
    declare const sdkGetLoginStatus: typeof getLoginStatus;
    /** @deprecated Use \`createAudiotoolClient\` — alias for older playground snippets. */
    declare const sdkCreateAudiotoolClient: typeof createAudiotoolClient;

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
