import React, { useState, useEffect } from "react";

export function SampleFunctionComponent(props) {
  const [count, setCount] = useState(0);
  const [test] = useState(0);

  useEffect(() => {
    console.log("useEffect");
  }, []);

  return (
    <>
      <div></div>
    </>
  );
}
