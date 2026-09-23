import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { PlanError } from "@/components/app/plan-error";
import { ApiError } from "@/lib/api";

test("a plan limit shows the server's message and a link to the plans", () => {
  render(<PlanError error={new ApiError(402, "Your plan allows 1 bot.", "upgrade_required")} billingHref="/app/billing?bot=b1" />);
  expect(screen.getByText(/Your plan allows 1 bot\./)).toBeTruthy();
  expect(screen.getByRole("link", { name: "See plans" }).getAttribute("href")).toBe("/app/billing?bot=b1");
});

test("other errors show only their message", () => {
  const { rerender } = render(<PlanError error={new ApiError(400, "Name is too long.")} billingHref="/app/billing" />);
  expect(screen.getByText("Name is too long.")).toBeTruthy();
  expect(screen.queryByRole("link")).toBeNull();

  rerender(<PlanError error="Remove the files that can’t be added." billingHref="/app/billing" />);
  expect(screen.getByText("Remove the files that can’t be added.")).toBeTruthy();

  rerender(<PlanError error={new Error("boom")} billingHref="/app/billing" />);
  expect(screen.getByText("Something went wrong. Try again.")).toBeTruthy();
});
