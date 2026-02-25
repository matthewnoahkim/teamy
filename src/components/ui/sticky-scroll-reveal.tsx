"use client";
import React, { useEffect, useRef, useState } from "react";
import { useMotionValueEvent, useScroll } from "framer-motion";
import { motion, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

export const StickyScroll = ({
  content,
  contentClassName,
}: {
  content: {
    title: string;
    description: string;
    content?: React.ReactNode;
  }[];
  contentClassName?: string;
}) => {
  const [activeCard, setActiveCard] = React.useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const cardLength = content.length;

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    // Calculate which card should be active based on scroll progress
    // Use a more precise calculation that ensures first and last cards are reachable
    const segmentSize = 1 / (cardLength - 1);
    let newActiveCard = Math.round(latest / segmentSize);
    
    // Clamp to valid range
    newActiveCard = Math.max(0, Math.min(cardLength - 1, newActiveCard));
    
    setActiveCard(newActiveCard);
  });

  // Calculate indicator progress - maps scroll progress to indicator height
  // This ensures the indicator reaches from the first to the last item
  const indicatorHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  // Subtle Teamy theme gradients - muted and elegant
  const subtleGradients = [
    "linear-gradient(160deg, rgba(0, 86, 199, 0.06) 0%, rgba(111, 214, 255, 0.02) 100%), hsl(var(--card))",
    "linear-gradient(160deg, rgba(26, 111, 234, 0.05) 0%, rgba(111, 214, 255, 0.03) 100%), hsl(var(--card))",
    "linear-gradient(160deg, rgba(0, 86, 199, 0.05) 0%, rgba(26, 111, 234, 0.02) 100%), hsl(var(--card))",
  ];

  const [backgroundGradient, setBackgroundGradient] = useState(
    subtleGradients[0]
  );

  useEffect(() => {
    setBackgroundGradient(subtleGradients[activeCard % subtleGradients.length]);
  }, [activeCard]);

  return (
    <motion.div
      className="flex flex-col lg:flex-row justify-center relative lg:space-x-10 rounded-2xl px-4 sm:px-6 lg:px-8 py-6"
      ref={ref}
    >
      <div className="relative flex items-start px-2 sm:px-3 lg:flex-1">
        {/* Scroll Indicator - Vertical line with dots */}
        <div className="hidden lg:block absolute left-1 top-10 bottom-10 w-0.5">
          <div className="relative h-full w-full">
            {/* Background line */}
            <div className="absolute inset-0 bg-border/60 rounded-full" />
            {/* Active indicator line */}
            <motion.div
              className="absolute top-0 left-0 w-full rounded-full origin-top shadow-sm"
              style={{
                height: indicatorHeight,
                background:
                  "linear-gradient(180deg, rgb(0, 86, 199) 0%, rgb(111, 214, 255) 100%)",
              }}
            />
            {/* Dots for each item */}
            {content.map((_, index) => {
              // Position dots evenly from top (0%) to bottom (100%)
              // Handle edge case when there's only one item
              const dotPosition = cardLength === 1 ? 50 : (index / (cardLength - 1)) * 100;
              return (
                <motion.div
                  key={index}
                  className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 transition-all duration-300 z-10 bg-background"
                  style={{
                    top: `${dotPosition}%`,
                    backgroundColor: activeCard === index ? "#0056C7" : "hsl(var(--background))",
                    borderColor: activeCard === index ? "#0056C7" : "hsl(var(--border))",
                    scale: activeCard === index ? 1.3 : 1,
                    boxShadow: activeCard === index ? "0 0 0 3px rgba(0, 86, 199, 0.1)" : "none",
                  }}
                />
              );
            })}
          </div>
        </div>

        <div className="max-w-2xl w-full lg:pl-14">
          {content.map((item, index) => (
            <div
              key={item.title + index}
              className={cn(
                "h-[260px] sm:h-[250px] flex flex-col justify-center rounded-2xl border px-5 sm:px-6 my-2 transition-all duration-300",
                activeCard === index
                  ? "bg-background border-teamy-primary/20 shadow-card"
                  : "bg-transparent border-transparent"
              )}
            >
              <motion.h2
                initial={{
                  opacity: 0,
                }}
                animate={{
                  opacity: activeCard === index ? 1 : 0.7,
                }}
                transition={{ duration: 0.3 }}
                className="text-2xl md:text-3xl font-bold text-foreground"
              >
                {item.title}
              </motion.h2>
              <motion.p
                initial={{
                  opacity: 0,
                }}
                animate={{
                  opacity: activeCard === index ? 1 : 0.7,
                }}
                transition={{ duration: 0.3 }}
                className="text-base md:text-lg text-muted-foreground max-w-lg mt-6 leading-relaxed"
              >
                {item.description}
              </motion.p>
              
              {/* Show card below text on mobile */}
              <motion.div
                initial={{
                  opacity: 0,
                }}
                animate={{
                  opacity: activeCard === index ? 1 : 0,
                }}
                transition={{ duration: 0.3 }}
                style={{ background: backgroundGradient }}
                className={cn(
                  "lg:hidden mt-8 h-60 w-full rounded-xl overflow-hidden shadow-lg border border-teamy-primary/10",
                  activeCard === index ? "block" : "hidden",
                  contentClassName
                )}
              >
                {item.content ?? null}
              </motion.div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Sticky card on desktop */}
      <div
        style={{ background: backgroundGradient }}
        className={cn(
          "hidden lg:block h-[340px] w-[400px] rounded-xl sticky top-28 overflow-hidden shadow-xl border border-teamy-primary/10 flex-shrink-0",
          contentClassName
        )}
      >
        {content[activeCard].content ?? null}
      </div>
    </motion.div>
  );
};
