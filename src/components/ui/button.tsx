import { Button as BaseButton } from "@base-ui/react/button";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Props = ComponentProps<typeof BaseButton> & { variant?: "primary" | "secondary" | "ghost"; size?: "default" | "small" | "icon" };

export function Button({ className, variant = "secondary", size = "default", ...props }: Props) {
  return <BaseButton className={cn("ui-button", "ui-button-" + variant, "ui-button-" + size, typeof className === "string" ? className : "")} {...props} />;
}
