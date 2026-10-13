package com.mocan.shop.service.storage;

import net.coobird.thumbnailator.Thumbnails;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

/**
 * Nén ảnh phía server bằng Thumbnailator — dùng cho ảnh USER (review):
 * resize cạnh dài nhất ≤ 1600px, xuất JPEG chất lượng 0.82; ảnh có kênh
 * alpha (PNG trong suốt) được ghép lên nền trắng trước khi xuất JPEG.
 *
 * Lưu ý: ImageIO của JDK không giải mã được WebP (thiếu plugin) — gặp ảnh
 * không đọc được thì compressToJpeg trả null để caller tự quyết (ReviewService
 * lưu nguyên bản đã validate ≤5MB thay vì chặn khách upload).
 */
public final class ImageCompressor {

  public static final int MAX_EDGE_PX = 1600;
  public static final double JPEG_QUALITY = 0.82;
  public static final String OUTPUT_CONTENT_TYPE = "image/jpeg";

  private ImageCompressor() {}

  /**
   * @return bytes JPEG đã nén, hoặc null nếu ImageIO không giải mã được ảnh
   *         (vd WebP) — KHÔNG coi là lỗi cứng.
   */
  public static byte[] compressToJpeg(byte[] original) throws IOException {
    BufferedImage src = ImageIO.read(new ByteArrayInputStream(original));
    if (src == null) {
      return null;
    }
    BufferedImage input = flattenOntoWhite(src);
    int width = input.getWidth();
    int height = input.getHeight();
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    var builder = Thumbnails.of(input)
        .outputFormat("jpg")
        .outputQuality(JPEG_QUALITY);
    if (Math.max(width, height) > MAX_EDGE_PX) {
      builder.size(MAX_EDGE_PX, MAX_EDGE_PX); // giữ tỉ lệ, cạnh dài nhất = 1600
    } else {
      builder.size(width, height); // ảnh nhỏ: giữ nguyên kích thước, chỉ re-encode JPEG
    }
    builder.toOutputStream(out);
    return out.toByteArray();
  }

  /** JPEG không có alpha: ảnh trong suốt phải ghép lên nền trắng, tránh nền đen. */
  private static BufferedImage flattenOntoWhite(BufferedImage src) {
    if (!src.getColorModel().hasAlpha()) {
      return src;
    }
    BufferedImage rgb = new BufferedImage(
        src.getWidth(), src.getHeight(), BufferedImage.TYPE_INT_RGB);
    Graphics2D g = rgb.createGraphics();
    try {
      g.setColor(Color.WHITE);
      g.fillRect(0, 0, rgb.getWidth(), rgb.getHeight());
      g.drawImage(src, 0, 0, null);
    } finally {
      g.dispose();
    }
    return rgb;
  }
}
