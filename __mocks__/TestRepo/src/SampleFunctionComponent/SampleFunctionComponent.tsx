import React, { useState, useEffect } from "react";

export function SampleFunctionComponent({
  name,
  otherName,
}: {
  name: string;
  otherName: string;
}) {
  const [count, setCount] = useState(0);
  const [test] = useState(0);

  const testFunction = ({
    internalTestProp,
  }: {
    internalTestProp: boolean;
  }) => {
    return test;
  };

  useEffect(() => {
    console.log("useEffect");
  }, []);

  return (
    <>
      <div className="text-red-500">{name}</div>
    </>
  );
}
