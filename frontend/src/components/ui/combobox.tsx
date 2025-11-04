import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";
import { cn } from "@/lib/utils";

interface ComboboxProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const Combobox: React.FC<ComboboxProps> = ({
  options,
  value,
  onChange,
  placeholder = "Select or type...",
  disabled = false,
  className = "",
}) => {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  const filteredOptions = React.useMemo(() => {
    const lower = inputValue.toLowerCase();
    return options.filter((opt) => opt.toLowerCase().includes(lower));
  }, [inputValue, options]);

  const handleSelect = (option: string) => {
    onChange(option);
    setOpen(false);
  };

  // onValueChange from CommandInput handles input changes

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        tabIndex={-1}
      >
        <span className={cn(!value && "text-muted-foreground")}>
          {value || placeholder}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full rounded-md bg-popover border border-border shadow-lg">
          <Command>
            <CommandInput
              ref={inputRef}
              value={inputValue}
              onValueChange={(val: string) => {
                setInputValue(val);
                onChange(val);
              }}
              placeholder={placeholder}
              disabled={disabled}
              autoFocus
            />
            <CommandList>
              <CommandEmpty>No options found.</CommandEmpty>
              <CommandGroup>
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={() => handleSelect(option)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option}
                  </CommandItem>
                ))}
                {inputValue && !options.includes(inputValue) && (
                  <CommandItem
                    key="__custom__"
                    value={inputValue}
                    onSelect={() => handleSelect(inputValue)}
                  >
                    <Check className="mr-2 h-4 w-4 opacity-100" />
                    Create "{inputValue}"
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
};
