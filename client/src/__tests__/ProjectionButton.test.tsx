import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProjectionButton } from "@/components/layout/ProjectionButton";

describe("ProjectionButton", () => {
  // ─── Core Rendering ─────────────────────────────────────────────────

  describe("Core Rendering", () => {
    it("renders projection-button", () => {
      render(<ProjectionButton isProjecting={false} onToggle={vi.fn()} />);
      expect(screen.getByTestId("projection-button")).toBeTruthy();
    });
  });

  // ─── Projecting State Permutations ──────────────────────────────────

  describe("isProjecting permutations", () => {
    it("shows 'Pop Out' when not projecting", () => {
      render(<ProjectionButton isProjecting={false} onToggle={vi.fn()} />);
      expect(screen.getByText("Pop Out")).toBeTruthy();
    });

    it("shows 'Projecting' when projecting", () => {
      render(<ProjectionButton isProjecting={true} onToggle={vi.fn()} />);
      expect(screen.getByText("Projecting")).toBeTruthy();
    });

    it("does NOT show 'Pop Out' when projecting", () => {
      render(<ProjectionButton isProjecting={true} onToggle={vi.fn()} />);
      expect(screen.queryByText("Pop Out")).toBeNull();
    });

    it("does NOT show 'Projecting' when not projecting", () => {
      render(<ProjectionButton isProjecting={false} onToggle={vi.fn()} />);
      expect(screen.queryByText("Projecting")).toBeNull();
    });
  });

  // ─── Callback ───────────────────────────────────────────────────────

  describe("Callback fires correctly", () => {
    [true, false].forEach((isProjecting) => {
      it(`calls onToggle when clicked (isProjecting=${isProjecting})`, () => {
        const onToggle = vi.fn();
        render(<ProjectionButton isProjecting={isProjecting} onToggle={onToggle} />);
        fireEvent.click(screen.getByTestId("projection-button"));
        expect(onToggle).toHaveBeenCalledTimes(1);
      });
    });

    it("calls onToggle for each click", () => {
      const onToggle = vi.fn();
      render(<ProjectionButton isProjecting={false} onToggle={onToggle} />);
      fireEvent.click(screen.getByTestId("projection-button"));
      fireEvent.click(screen.getByTestId("projection-button"));
      expect(onToggle).toHaveBeenCalledTimes(2);
    });
  });
});
