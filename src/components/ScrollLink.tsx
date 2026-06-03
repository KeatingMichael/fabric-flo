import { Link, type LinkProps } from "react-router-dom";
import { useScrollContainer } from "@/context/ScrollContainerContext";

/** In-app link that scrolls to the top when tapped. */
export function ScrollLink({ onClick, ...rest }: LinkProps) {
  const { scrollToTop } = useScrollContainer();

  return (
    <Link
      {...rest}
      onClick={(e) => {
        scrollToTop();
        onClick?.(e);
      }}
    />
  );
}
