"use client";
import { motion, AnimatePresence } from "framer-motion";

interface Product {
  sku: string;
  title: string;
  description?: string;
  price?: number;
  image_url?: string;
  product_url?: string;
}

interface ProductCardsProps {
  products: Product[];
  visible: boolean;            // true â†’ zeigen, false â†’ ausblenden
  onClose?: () => void;        // optionaler Callback (z. B. Auto-fade)
}

export default function ProductCards({ products, visible, onClose }: ProductCardsProps) {
  if (!products?.length) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.4 }}
          style={{
            position: "fixed",
            right: "20px",
            bottom: "120px", // Platz Ã¼ber dem Avatar
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            maxHeight: "60vh",
            overflowY: "auto",
            width: "260px",
            background: "rgba(255,255,255,0.95)",
            border: "1px solid #eee",
            borderRadius: "12px",
            boxShadow: "0 6px 20px rgba(0,0,0,0.1)",
            padding: "10px",
          }}
        >
          {products.map((p) => (
            <motion.div
              key={p.sku}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{
                border: "1px solid #ddd",
                borderRadius: "10px",
                overflow: "hidden",
                background: "#fff",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <img
                src={p.image_url}
                alt={p.title}
                style={{ width: "100%", height: "150px", objectFit: "cover" }}
              />
              <div style={{ padding: "10px" }}>
                <h4
                  style={{
                    fontSize: "0.95rem",
                    margin: "0 0 6px 0",
                    color: "#111",
                  }}
                >
                  {p.title}
                </h4>
                <p
                  style={{
                    fontSize: "0.8rem",
                    color: "#555",
                    margin: "0 0 6px 0",
                    minHeight: "32px",
                  }}
                >
                  {p.description?.slice(0, 50) ?? ""}
                  {p.description && p.description.length > 50 ? "â€¦" : ""}
                </p>
                <p style={{ fontWeight: "bold", color: "#0070f3", marginBottom: "8px" }}>
                  {p.price?.toFixed(2)} â‚¬
                </p>
                <a
                  href={p.product_url}
                  target="_blank"
                  style={{
                    display: "block",
                    textAlign: "center",
                    background: "#0070f3",
                    color: "white",
                    borderRadius: "6px",
                    padding: "6px 10px",
                    textDecoration: "none",
                    fontSize: "0.85rem",
                    fontWeight: 500,
                  }}
                >
                  Zum Produkt â†’
                </a>
              </div>
            </motion.div>
          ))}

          {/* SchlieÃŸen-Button */}
          <button
            onClick={onClose}
            style={{
              marginTop: "10px",
              border: "none",
              background: "#eee",
              borderRadius: "8px",
              padding: "6px",
              cursor: "pointer",
              fontSize: "0.8rem",
            }}
          >
            âœ• SchlieÃŸen
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

