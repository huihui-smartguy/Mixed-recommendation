import { Drawer } from 'antd';
import type { Product } from '@/types';
import FundCard from './FundCard';

interface Props {
  open: boolean;
  product: Product | null;
  selectedCompare: Product[];
  onToggleCompare: (p: Product) => void;
  onClose: () => void;
}

/**
 * 移动端底抽屉（Bottom Sheet）：覆盖屏幕约 70%，下拉关闭，
 * 完美保持对话上下文不断点 — 看完即关，不会跳页面。
 * 复用 antd Drawer placement="bottom"，圆角与高度通过 styles 注入。
 */
export default function ProductSheet({
  open,
  product,
  selectedCompare,
  onToggleCompare,
  onClose
}: Props) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="bottom"
      height="70%"
      title={product ? `${product.name} · ${product.code}` : '产品详情'}
      closable
      maskClosable
      styles={{
        content: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
        body: { padding: 16 }
      }}
    >
      {product ? (
        <div className="product-sheet-wrap">
          <FundCard
            product={product}
            selected={selectedCompare.some((x) => x.code === product.code)}
            onToggle={onToggleCompare}
          />
          <div className="muted" style={{ marginTop: 16, lineHeight: 1.7 }}>
            AI 推荐仅供参考，不构成投资建议。下拉或点击遮罩可关闭返回对话。
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}
