export const additionalImageSamples: Record<"gif" | "avif" | "ico", string> = {
  gif: "R0lGODdhtAB4AIEAAP///yld2QAAAAAAACwAAAAAtAB4AEAI/wADCBxIsKDBgwgTKlzIsKHDhxAjSpxIsaLFixgzatzIsaPHjyBDihxJsqTJkxkBqFzJEgDKlzA/tpxJs6bNmTFz6hR4s6fPny13Cg0JtKhRn0OTajzKtOlKpVBTOp1qM6rVjlSbXt2qsyfXr2DDih1LtqzZs2jTql3Ltq3bt3DjyiWaleZcs3Wz3oWaty/LvV39CnYJOObgvoWHHj6aOOzixpAjS55MubLly5gza97MubPnz6BDix5NurTpwFNP51z8VzVI1l5dY4RtVPZE2lptO8TtVDdD3ql9JwTeW/hw4rWNK0QOVHlD5lWdQ4SuUvpF3NZfU83Ovbv37+DDi40fT768+fPo06tfz769+/fw48ufT7++/fv48+uXn3v/QL/5wTYfcu5RR1h6BlZ3XoJBkccgTuI9aBd4EtZEYYUQdoehhRpumGF2Hn5oXYgNckdiayaeqGCHJF7YoosbjudheRiix+B6BhZI3ICsBYiYf/8xBeSQRBZp5JFIJqnkkkw26eSTUEYp5ZQjBQQAOw==",
  avif: "AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADrbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAAAAAAAOcGl0bQAAAAAAAQAAAB5pbG9jAAAAAEQAAAEAAQAAAAEAAAETAAABQQAAAChpaW5mAAAAAAABAAAAGmluZmUCAAAAAAEAAGF2MDFDb2xvcgAAAABqaXBycAAAAEtpcGNvAAAAFGlzcGUAAAAAAAAAtAAAAHgAAAAQcGl4aQAAAAADCAgIAAAADGF2MUOBAAwAAAAAE2NvbHJuY2x4AAEADQAGgAAAABdpcG1hAAAAAAAAAAEAAQQBAoMEAAABSW1kYXQSAAoJGB2s+7RAQ0GhMrECRDx4eGZQGGGH4QAAAIDCEROmAWtiDZTSDkHH+y66rqi119uDsUGn6hBHd1/DSsoe/SGBjzlu4YzOzKS9Ir/Xpct7/hxhIuyi9P4f5EZIJiCRDEqD2PlfGfiSk+91lY5k76EMBsE9Lavg8qOoO4XwtV6fUETzUxfAiMSh1G6qT6KHXf+AY4vv3Jra4K8IZlfB7RTy1FVX3j2giTcp7gJfiMwLoc6+hptCtoPMPSaoMj8+kvlARB/DZ3Xwx26iutT7n2IWY65NYzB1GSlSoF/zzUW03J91dIeyqyZX1zG67b24gw7wVkysVa30NAnOn/khTXGwVDKukUGaYnr28rxqLe8B1ufj1R8x2m1AkuoMfoUcjac4QxF/frVYEO9d6sth5hvv07c0Mq4axOqcEbC4swI=",
  ico: "AAABAAEAQEAAAAAAIAAsAQAAFgAAAIlQTkcNChoKAAAADUlIRFIAAABAAAAAQAgCAAAAJQvmiQAAAPNJREFUeJztmVEOgkAQQ8F4FhK9Ex7OQ5Hoafzwh4Am0unY3Uzfpwl13nYhWRgv82PomZN6gCgWUGMBNRZQYwE1FlBjATUWUHNOyl3u0/7H6+1J/6ORe6D5OPceoglN4MfR11A0OPcAMD181YZoA5QhIlWEGqBMH8zp/jGKC7CWP5gGCnCnj2SW3EIZyw8nl2ygKQ4L5O0fLL9eA61hATUWUHNYIONcG8mv10BrIAJ5uwhILtnAkFMClok3wHWA06puoTesEiI5nFeL8CEhvgScLYTNQSnQb6e/0Ov3gf9T+zHaAhZQYwE1FlBjATUWUGMBNS8dQURzrRJOgQAAAABJRU5ErkJggg==",
};

export function bmpSample(): Uint8Array {
  const width = 180, height = 120, stride = Math.ceil(width * 3 / 4) * 4;
  const data = new Uint8Array(54 + stride * height);
  const view = new DataView(data.buffer);
  view.setUint16(0, 0x4d42, true);
  view.setUint32(2, data.length, true);
  view.setUint32(10, 54, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(34, stride * height, true);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = 54 + y * stride + x * 3;
      const white = (x - 90) ** 2 + (height - y - 1 - 60) ** 2 <= 28 ** 2;
      data[offset] = white ? 255 : 217;
      data[offset + 1] = white ? 255 : 93;
      data[offset + 2] = white ? 255 : 41;
    }
  }
  return data;
}
