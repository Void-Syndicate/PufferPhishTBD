import { InputHTMLAttributes } from "react";
import styles from "./TextInput.module.css";

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export default function TextInput({ label, className = "", id, ...props }: TextInputProps) {
  const inputId = id || `input-${label?.replace(/\s/g, "-").toLowerCase()}`;

  return (
    <div className={`${styles.wrapper} ${className}`}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
      )}
      <input id={inputId} className={styles.input} {...props} />
    </div>
  );
}
