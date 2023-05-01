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

  const testFunction = ({ test }: { test: boolean }) => {
    return test;
  };

  useEffect(() => {
    console.log("useEffect");
  }, []);

  return (
    <>
      <div>{name}</div>
    </>
  );
}
