import React, { useState } from "react";

export const SampleArrowComponent = ({ lastName }: { lastName: string }) => {
  const [name, setName] = useState("SampleFunctionComponent");
  return (
    <div>
      {name}
      {lastName}
    </div>
  );
};
