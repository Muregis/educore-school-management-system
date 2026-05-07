import React from "react";
import Skeleton from "./Skeleton";

export default function SkeletonRow({ columns = 4 }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, index) => (
        <td key={index}>
          <Skeleton height="16px" width={index === 0 ? "72%" : "54%"} />
        </td>
      ))}
    </tr>
  );
}
