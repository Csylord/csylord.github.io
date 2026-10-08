export const placeholder = (n: number) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <text x="50%" y="50%" fill="#bbbbbb" font-family="sans-serif"
        font-size="64" text-anchor="middle" dominant-baseline="middle">
        Image ${n}
      </text>
    </svg>`
  )}`;