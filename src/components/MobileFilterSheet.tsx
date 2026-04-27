import { useState } from "react";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

interface MobileFilterSheetProps {
  children: React.ReactNode;
  activeCount?: number;
}

export function MobileFilterSheet({ children, activeCount = 0 }: MobileFilterSheetProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 relative">
          <Filter className="h-4 w-4" />
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl px-5 pb-8">
        <SheetHeader>
          <SheetTitle className="font-heading">Filters</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          {children}
        </div>
        <Button className="w-full mt-6" onClick={() => setOpen(false)}>Apply Filters</Button>
      </SheetContent>
    </Sheet>
  );
}
