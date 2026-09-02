import { Version } from "@microsoft/sp-core-library";
import {
  type IPropertyPaneConfiguration,
  PropertyPaneTextField,
} from "@microsoft/sp-property-pane";
import { BaseClientSideWebPart } from "@microsoft/sp-webpart-base";
import * as strings from "Mi20ArboWebPartStrings";

export interface IMi20ArboWebPartProps {
  appUrl: string;
  height: string;
}

export default class Mi20ArboWebPart extends BaseClientSideWebPart<IMi20ArboWebPartProps> {
  public render(): void {
    const url = this.properties.appUrl || "https://localhost:5173";
    const height = this.properties.height || "85vh";
    this.domElement.innerHTML = `
      <div style="width:100%;min-height:480px;">
        <iframe
          src="${encodeURI(url)}"
          title="MI20 Arbo"
          style="width:100%;height:${height};border:0;background:#fff;"
          allow="downloads *; clipboard-read *; clipboard-write *"
        ></iframe>
      </div>`;
  }

  protected onInit(): Promise<void> {
    return super.onInit();
  }

  protected get dataVersion(): Version {
    return Version.parse("1.0");
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: { description: strings.PropertyPaneDescription },
          groups: [
            {
              groupName: strings.BasicGroupName,
              groupFields: [
                PropertyPaneTextField("appUrl", { label: strings.AppUrlFieldLabel }),
                PropertyPaneTextField("height", { label: strings.HeightFieldLabel }),
              ],
            },
          ],
        },
      ],
    };
  }
}
