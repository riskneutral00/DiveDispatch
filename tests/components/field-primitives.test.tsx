// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "../helpers/render";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Textarea } from "@/components/ui/textarea";

describe("field primitives", () => {
  it("defaults input and simple-select wrappers to w-full without caller width classes", () => {
    const { container } = render(
      <>
        <Input label="Input" />
        <SimpleSelect
          label="Select"
          value=""
          onChange={() => {}}
          options={[{ value: "", label: "Pick one" }, { value: "a", label: "A" }]}
        />
      </>,
    );

    const wrappers = Array.from(container.children) as HTMLElement[];
    expect(wrappers[0].className).toContain("w-full");
    expect(wrappers[1].className).toContain("w-full");
  });

  it("preserves caller width classes on wrappers", () => {
    const { container } = render(
      <>
        <Input label="Input" className="w-40" />
        <Textarea label="Textarea" className="field-text-long" />
        <SimpleSelect
          label="Select"
          className="col-span-3"
          value="a"
          onChange={() => {}}
          options={[{ value: "a", label: "A" }]}
        />
      </>,
    );

    const wrappers = Array.from(container.children) as HTMLElement[];
    expect(wrappers[0].className).toContain("w-40");
    expect(wrappers[0].className).not.toContain("w-full");
    expect(wrappers[1].className).toContain("field-text-long");
    expect(wrappers[1].className).not.toContain("w-full");
    expect(wrappers[2].className).toContain("col-span-3");
    expect(wrappers[2].className).not.toContain("w-full");
  });

  it("keeps required markers and text-float-label on floated labels", async () => {
    render(
      <>
        <Input label="Name" required />
        <Textarea label="Notes" required />
        <SimpleSelect
          label="Role"
          required
          value="captain"
          onChange={() => {}}
          options={[{ value: "captain", label: "Captain" }]}
        />
      </>,
    );

    const inputLabel = screen.getByText(/^Name$/).closest("label");
    const textareaLabel = screen.getByText(/^Notes$/).closest("label");
    const selectLabel = screen.getByText(/^Role$/).closest("label");

    fireEvent.focus(screen.getByLabelText(/Name \*/));
    fireEvent.focus(screen.getByLabelText(/Notes \*/));

    await waitFor(() => {
      expect(inputLabel?.className).toContain("label-float-in");
      expect(textareaLabel?.className).toContain("label-float-in");
      expect(selectLabel?.className).toContain("label-float-in");
    });

    expect(screen.getAllByText("*")).toHaveLength(3);
  });
});
