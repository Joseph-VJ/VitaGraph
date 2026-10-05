import React from "react";
import { PageState } from "./PageState";

export interface PersonaStateProps {
  loading: boolean;
  onRetry: () => void;
}

export const PersonaState: React.FC<PersonaStateProps> = ({ loading, onRetry }) => {
  if (loading) {
    return <PageState kind="loading" title="Loading your persona" />;
  }

  return (
    <PageState
      kind="offline"
      title="No persona available"
      detail="The backend did not return a persona. Check that it is running, then try again."
      action={{ label: "Try again", onClick: onRetry }}
    />
  );
};
