import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { WidgetPreview } from "@/components/widget-preview";

test("the preview closes to the launcher and opens again, like the real widget", async () => {
  const user = userEvent.setup();
  render(<WidgetPreview position="right" name="Northwind Coffee" avatar="N" color="#2F6B4F" greeting="Hey there, how can I help?" />);

  expect(screen.getByText("Hey there, how can I help?")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Close chat" }));

  expect(screen.queryByText("Hey there, how can I help?")).toBeNull();
  const launcher = screen.getByRole("button", { name: "Open chat with Northwind Coffee" });
  expect(launcher.getAttribute("style")).toContain("background: rgb(47, 107, 79)");

  await user.click(launcher);
  expect(screen.getByText("Hey there, how can I help?")).toBeTruthy();
});
