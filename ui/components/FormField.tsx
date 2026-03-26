import { type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

type BaseProps = {
  label: string;
  name: string;
  error?: string;
  charCount?: number;
  maxLengthDisplay?: number;
};

type InputProps = BaseProps & { as?: "input" } & InputHTMLAttributes<HTMLInputElement>;
type SelectProps = BaseProps & { as: "select"; children: React.ReactNode } & SelectHTMLAttributes<HTMLSelectElement>;
type TextareaProps = BaseProps & { as: "textarea" } & TextareaHTMLAttributes<HTMLTextAreaElement>;

type FormFieldProps = InputProps | SelectProps | TextareaProps;

const baseClass = "w-full rounded border p-3 text-zinc-900";
const normalBorder = "border-zinc-300";
const errorBorder = "border-red-400";

export default function FormField(props: FormFieldProps) {
  const { label, name, error, charCount, maxLengthDisplay, as = "input", ...rest } = props;
  const children = "children" in props ? props.children : undefined;
  const className = `${baseClass} ${error ? errorBorder : normalBorder}`;
  const showFooter = error || (maxLengthDisplay !== undefined && charCount !== undefined);

  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium text-zinc-800">
        {label}{rest.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {as === "select" ? (
        <select id={name} name={name} className={className} {...rest as any}>{children}</select>
      ) : as === "textarea" ? (
        <textarea id={name} name={name} rows={4} className={className} {...rest as any} />
      ) : (
        <input id={name} name={name} className={className} {...rest as any} />
      )}

      {showFooter && (
        <div className="mt-1 flex justify-between">
          <div>{error && <p className="text-sm text-red-600">{error}</p>}</div>
          {maxLengthDisplay !== undefined && charCount !== undefined && (
            <p className={`text-xs ${charCount > maxLengthDisplay ? "text-red-500" : "text-zinc-400"}`}>
              {charCount} / {maxLengthDisplay}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
