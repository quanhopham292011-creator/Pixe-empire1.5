/**
 * Danh sách quốc gia thật theo vị trí ngoài đời thực [kinh độ, vĩ độ].
 * dev = true: quốc gia phát triển (khởi đầu mạnh hơn).
 */
export interface WorldCountry {
  name: string;
  lon: number;
  lat: number;
  dev: boolean;
}

export const WORLD_COUNTRIES: WorldCountry[] = [
  // --- Quốc gia phát triển ---
  { name: 'Hoa Kỳ', lon: -98, lat: 39, dev: true },
  { name: 'Canada', lon: -100, lat: 57, dev: true },
  { name: 'Anh', lon: -1.5, lat: 52.5, dev: true },
  { name: 'Pháp', lon: 2.5, lat: 47, dev: true },
  { name: 'Đức', lon: 10.5, lat: 51.2, dev: true },
  { name: 'Ý', lon: 12.5, lat: 42.8, dev: true },
  { name: 'Tây Ban Nha', lon: -3.5, lat: 40, dev: true },
  { name: 'Thụy Điển', lon: 16, lat: 62, dev: true },
  { name: 'Na Uy', lon: 9, lat: 61, dev: true },
  { name: 'Ba Lan', lon: 19.5, lat: 52, dev: true },
  { name: 'Nga', lon: 60, lat: 58, dev: true },
  { name: 'Nhật Bản', lon: 138, lat: 36, dev: true },
  { name: 'Hàn Quốc', lon: 127.8, lat: 36.5, dev: true },
  { name: 'Trung Quốc', lon: 103, lat: 35, dev: true },
  { name: 'Úc', lon: 134, lat: -25, dev: true },
  { name: 'New Zealand', lon: 172, lat: -41.5, dev: true },
  { name: 'Ả Rập Xê Út', lon: 45, lat: 24, dev: true },
  // --- Các quốc gia khác ---
  { name: 'Thái Lan', lon: 101, lat: 15, dev: false },
  { name: 'Myanmar', lon: 96, lat: 21, dev: false },
  { name: 'Indonesia', lon: 113, lat: -2, dev: false },
  { name: 'Philippines', lon: 122, lat: 13, dev: false },
  { name: 'Ấn Độ', lon: 78, lat: 22, dev: false },
  { name: 'Pakistan', lon: 69, lat: 30, dev: false },
  { name: 'Afghanistan', lon: 66, lat: 34, dev: false },
  { name: 'Iran', lon: 54, lat: 32, dev: false },
  { name: 'Thổ Nhĩ Kỳ', lon: 35, lat: 39, dev: false },
  { name: 'Kazakhstan', lon: 67, lat: 48, dev: false },
  { name: 'Mông Cổ', lon: 103, lat: 47, dev: false },
  { name: 'Ukraine', lon: 31, lat: 49, dev: false },
  { name: 'Ai Cập', lon: 30, lat: 27, dev: false },
  { name: 'Libya', lon: 17, lat: 27, dev: false },
  { name: 'Algeria', lon: 3, lat: 28, dev: false },
  { name: 'Mali', lon: -3, lat: 17, dev: false },
  { name: 'Nigeria', lon: 8, lat: 9, dev: false },
  { name: 'Sudan', lon: 30, lat: 15, dev: false },
  { name: 'Ethiopia', lon: 40, lat: 8, dev: false },
  { name: 'Tanzania', lon: 35, lat: -6, dev: false },
  { name: 'Cộng hòa Dân chủ Congo', lon: 23, lat: -3, dev: false },
  { name: 'Angola', lon: 17, lat: -12, dev: false },
  { name: 'Nam Phi', lon: 25, lat: -29, dev: false },
  { name: 'Madagascar', lon: 47, lat: -19, dev: false },
  { name: 'Brazil', lon: -52, lat: -10, dev: false },
  { name: 'Argentina', lon: -65, lat: -35, dev: false },
  { name: 'Chile', lon: -71, lat: -33, dev: false },
  { name: 'Peru', lon: -75, lat: -10, dev: false },
  { name: 'Bolivia', lon: -64, lat: -17, dev: false },
  { name: 'Colombia', lon: -74, lat: 4, dev: false },
  { name: 'Venezuela', lon: -66, lat: 7, dev: false },
  { name: 'Mexico', lon: -102, lat: 23, dev: false },
];
