import { useState } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

interface CarouselProps {
  images: string[];
  alt: string;
}

export function Carousel({ images, alt }: CarouselProps) {
  const [index, setIndex] = useState(0);

  const prev = () => setIndex((i) => (i - 1 + images.length) % images.length);
  const next = () => setIndex((i) => (i + 1) % images.length);

  return (
    <div
      className="carousel"
      role="group"
      aria-roledescription="carousel"
      aria-label={`${alt} images`}
    >
      <div
        className="carousel-track"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {images.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={`${alt}, image ${i + 1} of ${images.length}`}
          />
        ))}
      </div>

      {images.length > 1 && (
        <>
          <button
            className="carousel-btn prev"
            onClick={prev}
            aria-label="Previous image"
          >
            <FaChevronLeft aria-hidden="true" />
          </button>
          <button
            className="carousel-btn next"
            onClick={next}
            aria-label="Next image"
          >
            <FaChevronRight aria-hidden="true" />
          </button>

          <div className="carousel-dots">
            {images.map((_, i) => (
              <button
                key={i}
                className={i === index ? "dot active" : "dot"}
                onClick={() => setIndex(i)}
                aria-label={`Go to image ${i + 1}`}
                aria-current={i === index}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}