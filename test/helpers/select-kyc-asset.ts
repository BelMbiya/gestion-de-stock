import { fireEvent, screen, within } from "@testing-library/react";

function clickAssetOption(field: HTMLElement, assetName: string) {
  const listId = field.getAttribute("aria-controls");
  if (!listId) {
    throw new Error("AssetSearchSelect listbox is not open (missing aria-controls)");
  }
  const listbox = document.getElementById(listId);
  if (!listbox) {
    throw new Error(`AssetSearchSelect listbox #${listId} not found`);
  }
  const option = within(listbox).getByRole("option", { name: new RegExp(assetName, "i") });
  fireEvent.click(option);
}

/** Selectionne un article via le combobox KYC (DESCRIPTION). */
export function selectKycAsset(labelText: string, assetName: string, index = 0) {
  const fields = screen.getAllByLabelText(labelText);
  const field = fields[index] ?? fields[0];
  fireEvent.change(field, { target: { value: assetName.slice(0, 6) } });
  clickAssetOption(field, assetName);
}

export function selectKycAssetInContainer(
  container: HTMLElement,
  labelText: string,
  assetName: string,
) {
  const field = within(container).getByLabelText(labelText);
  fireEvent.change(field, { target: { value: assetName.slice(0, 6) } });
  clickAssetOption(field, assetName);
}
