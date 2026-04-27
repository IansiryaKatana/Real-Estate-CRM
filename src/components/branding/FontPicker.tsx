import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { GOOGLE_FONT_FAMILIES } from "@/data/googleFonts";

type FontPickerProps = {
  id?: string;
  label: string;
  value: string;
  onValueChange: (family: string) => void;
  disabled?: boolean;
};

export function FontPicker({ id, label, value, onValueChange, disabled }: FontPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium leading-none">
        {label}
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal h-10 px-3"
          >
            <span className="truncate text-left" style={{ fontFamily: `"${value}", sans-serif` }}>
              {value}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(100vw-2rem,420px)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search fonts…" />
            <CommandList>
              <CommandEmpty>No font found.</CommandEmpty>
              <CommandGroup className="max-h-[min(60vh,320px)] overflow-y-auto">
                {GOOGLE_FONT_FAMILIES.map((family) => (
                  <CommandItem
                    key={family}
                    value={family}
                    onSelect={() => {
                      onValueChange(family);
                      setOpen(false);
                    }}
                    style={{ fontFamily: `"${family}", sans-serif` }}
                  >
                    <Check className={cn("mr-2 h-4 w-4 shrink-0", value === family ? "opacity-100" : "opacity-0")} />
                    {family}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
