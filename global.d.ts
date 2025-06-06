interface Window {
  google: any; // Or more specific types if available for google.picker
  gapi: any; // Also adding gapi as it's used for loading scripts
}

declare global {
  interface Window {
    gapi: {
      load: (apiName: "picker", callback: () => void) => void;
    };
    google: {
      picker: {
        Action: {
          PICKED: string;
          CANCEL: string;
        };
        DocsViewMode: {
          GRID: string;
          LIST: string; // Even if not used, good for completeness
        };
        ViewId: {
          DOCS: string;
          RECENTLY_PICKED: string;
          FOLDERS: string;
          // Other common ViewIds, add as needed
          DOCUMENTS?: string;
          SPREADSHEETS?: string;
          PRESENTATIONS?: string;
          PDFS?: string;
          PHOTOS?: string;
          VIDEOS?: string;
        };
        Feature?: {
          MULTISELECT_ENABLED?: string;
          NAV_HIDDEN?: string;
        };
        DocsView: new (viewId?: string | google.picker.ViewIdValue) => google.picker.DocsViewInstance;
        PickerBuilder: new () => google.picker.PickerBuilderInstance;
        // If a generic View class is ever needed (though DocsView seems to cover current uses):
        // View: new (viewId: string | google.picker.ViewIdValue) => google.picker.ViewInstance;
      };
    };
  }

  // Namespace for google.picker types to avoid polluting global Window too much
  namespace google.picker {
    type ViewIdValue = Window["google"]["picker"]["ViewId"][keyof Window["google"]["picker"]["ViewId"]];
    type DocsViewModeValue =
      Window["google"]["picker"]["DocsViewMode"][keyof Window["google"]["picker"]["DocsViewMode"]];
    type ActionValue = Window["google"]["picker"]["Action"][keyof Window["google"]["picker"]["Action"]];

    interface PickerDocument {
      id: string;
      name: string;
      mimeType?: string;
      url?: string;
      // Add other document properties if they become necessary
    }

    interface PickerResponseData {
      action: ActionValue;
      docs?: PickerDocument[];
      viewToken?: any; // Can be more specific if structure is known
      parents?: any[]; // Can be more specific if structure is known
    }

    interface PickerInstance {
      setVisible: (visible: boolean) => void;
      dispose?: () => void; // Good practice to include if available
    }

    interface ViewInstance {
      setLabel: (label: string) => this;
      // Common view methods, add as necessary
      // setQuery?: (query: string) => this;
      // setMimeTypes?: (mimeTypes: string) => this;
    }

    interface DocsViewInstance extends ViewInstance {
      setIncludeFolders: (include: boolean) => this;
      setSelectFolderEnabled: (enabled: boolean) => this;
      setMode: (mode: DocsViewModeValue) => this;
      setStarred: (starred: boolean) => this;
      // Add other DocsView specific methods if needed
      // setOwnedByMe?: (owned: boolean) => this;
      // setParent?: (parentId: string) => this;
    }

    interface PickerBuilderInstance {
      addView: (view: DocsViewInstance /* | ViewInstance */) => this;
      setOAuthToken: (token: string) => this;
      setDeveloperKey: (key: string) => this;
      setCallback: (callback: (data: PickerResponseData) => void) => this;
      setTitle: (title: string) => this;
      build: () => PickerInstance;
      setAppId?: (appId: string) => this;
      setSize?: (width: number, height: number) => this;
      enableFeature?: (feature: string) => this;
      disableFeature?: (feature: string) => this;
      setLocale?: (locale: string) => this;
      setOrigin?: (origin: string) => this;
      // Add other PickerBuilder methods if needed
    }
  }
}

// This export is necessary to treat this file as a module and make 'declare global' work.
export {};
