import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Each test renders into a fresh document.
afterEach(cleanup);

// jsdom doesn't lay out pages, so it has no scrollIntoView.
Element.prototype.scrollIntoView ??= function () {};
