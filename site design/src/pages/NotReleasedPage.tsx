import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { EmptyState, Button, Marginalia } from "../components/gallery";
import { transitionNavigate, setNavDirection } from "../motion/navigation";

interface NotReleasedPageProps {
  featureName: string;
  description?: string;
}

export const NotReleasedPage: React.FC<NotReleasedPageProps> = ({
  featureName,
  description = "This capability is scheduled for a future release cycle.",
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-xl mx-auto text-center gap-6 py-12">
      <Marginalia
        text="Same data. Deeper understanding."
        sketch="leaf"
        className="mb-2"
      />

      <div className="w-full">
        <h2 className="type-display text-2xl text-[var(--bone)] mb-2">
          {featureName}
        </h2>
        <p className="type-meta text-[var(--dim)] mb-6">
          {description}
        </p>

        <EmptyState
          quote="Not in first release — reserved for future version"
          actionLabel="Return to workspace overview"
          onAction={() => {
            transitionNavigate(navigate, "/", { direction: "back" });
          }}
          className="w-full"
        />
      </div>

      <div className="flex items-center gap-3">
        <Link to="/" viewTransition onClick={() => setNavDirection("back")}>
          <Button variant="ghost">Workspace overview</Button>
        </Link>
        <Link to="/graph" viewTransition onClick={() => setNavDirection("forward")}>
          <Button variant="ghost">Knowledge Graph</Button>
        </Link>
      </div>
    </div>
  );
};
