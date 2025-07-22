
import React from "react";
import PlatformerGame from "@/components/PlatformerGame";

const Index: React.FC = () => {
  const handleReturnFromGame = () => {
    // For now, just reload the page or handle return logic
    window.location.reload();
  };

  return (
    <div>
      <PlatformerGame onReturn={handleReturnFromGame} />
    </div>
  );
};

export default Index;
