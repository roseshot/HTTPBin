import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { Dropdown } from "./dropdown";

afterEach(cleanup);

describe("Custom CSS dropdown", () => {
  test("renders a styled combobox instead of the operating-system select", async () => {
    function TestDropdown() {
      const [method, setMethod] = useState<"GET" | "POST">("GET");
      return <Dropdown ariaLabel="HTTP method" variant="method" value={method} onChange={setMethod} options={[
        { value: "GET", label: "GET" },
        { value: "POST", label: "POST" },
      ]} />;
    }

    const { container } = render(<TestDropdown />);
    expect(container.querySelector("select")).toBeNull();
    const trigger = screen.getByRole("combobox", { name: "HTTP method" });
    expect(trigger.textContent).toContain("GET");
    fireEvent.click(trigger);

    const option = await screen.findByRole("option", { name: "POST" });
    fireEvent.click(option);
    await waitFor(() => expect(trigger.textContent).toContain("POST"));
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  test("keeps translated labels separate from selected values", () => {
    const { container } = render(<Dropdown
      ariaLabel="Language"
      variant="language"
      value="zh-CN"
      options={[
        { value: "en", label: "English" },
        { value: "zh-CN", label: "简体中文" },
      ]}
      onChange={() => {}}
    />);
    expect(screen.getByRole("combobox", { name: "Language" }).textContent).toContain("简体中文");
    expect(container.querySelector("select")).toBeNull();
  });
});
