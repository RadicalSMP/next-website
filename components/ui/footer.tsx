"use client"
import { Button } from "./button";
import { org } from "@/app/resource/content";

export const Footer = () => {

  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-sm text-muted-foreground">
            © { new Date().getFullYear() } / <strong>RadicalSMP</strong>
          </p>
          <div className="flex items-center gap-2">
            {org.social.map((item) => {
              const IconComponent = item.icon;
              return (
                <Button key={item.name} size="icon" variant="ghost" asChild>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.name}
                  >
                    <IconComponent className="h-4 w-4" />
                  </a>
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    </footer>
  );
};