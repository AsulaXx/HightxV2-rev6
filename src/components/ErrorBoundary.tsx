import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Compact mode: smaller boundary intended to wrap a single tab/section instead of the full page */
  compact?: boolean;
  /** When this key changes, the boundary resets (clear error). Useful for tabs. */
  resetKey?: string | number;
  /** Optional label shown in compact mode (e.g. tab name) */
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  private reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.compact) {
      return (
        <div className="glass-card p-6 text-center space-y-3 max-w-xl mx-auto my-4">
          <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertTriangle size={20} className="text-destructive" />
          </div>
          <h2 className="text-base font-semibold text-foreground">
            {this.props.label ? `แท็บ "${this.props.label}" มีปัญหา` : "ส่วนนี้เกิดข้อผิดพลาด"}
          </h2>
          <p className="text-xs text-muted-foreground">
            ส่วนอื่นยังใช้งานได้ปกติ ลองกดปุ่มลองใหม่หรือเปลี่ยนแท็บ
          </p>
          {this.state.error && (
            <details className="text-left">
              <summary className="text-[10px] text-muted-foreground cursor-pointer">รายละเอียด</summary>
              <pre className="mt-2 p-2 rounded-lg bg-muted/20 text-[10px] text-muted-foreground overflow-auto max-h-24 font-mono">
                {this.state.error.message}
              </pre>
            </details>
          )}
          <button
            onClick={this.reset}
            className="btn-glass px-4 py-2 text-xs inline-flex items-center gap-1.5"
          >
            <RefreshCw size={12} /> ลองใหม่
          </button>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="glass-card max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertTriangle size={32} className="text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground">เกิดข้อผิดพลาด</h1>
          <p className="text-sm text-muted-foreground">
            ขออภัย เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองรีเฟรชหน้าเว็บ
          </p>
          {this.state.error && (
            <details className="text-left">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                รายละเอียดข้อผิดพลาด
              </summary>
              <pre className="mt-2 p-3 rounded-xl bg-muted/20 text-[10px] text-muted-foreground overflow-auto max-h-32 font-mono">
                {this.state.error.message}
              </pre>
            </details>
          )}
          <div className="flex gap-2 justify-center pt-2">
            <button
              onClick={() => window.location.reload()}
              className="btn-gradient px-5 py-2.5 text-sm flex items-center gap-2"
            >
              <RefreshCw size={14} /> รีเฟรช
            </button>
            <button
              onClick={() => { window.location.href = "/"; }}
              className="btn-glass px-5 py-2.5 text-sm flex items-center gap-2"
            >
              <Home size={14} /> หน้าหลัก
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
