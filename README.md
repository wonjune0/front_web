# front_web — 이커머스 스토어프론트 (정적 웹)

상품 탐색부터 주문 완료까지의 화면을 담당하는 프론트엔드입니다.
빌드 도구 없이 순수 HTML / CSS / ES 모듈로 작성되어 있고, S3에 정적 호스팅되어
CloudFront로 서비스됩니다.

| 항목 | 값 |
|---|---|
| 구성 | HTML + CSS + Vanilla JS (ES Modules) |
| 빌드 | 없음 (`package.json`, 번들러 없음) |
| 호스팅 | S3 + CloudFront (OAC) |
| API | 같은 도메인의 `/api/*` |

관련 리포지토리
- 백엔드 (Spring Boot): [`wonjune0/back_web`](https://github.com/wonjune0/back_web)
- 인프라 (Terraform): [`wonjune0/terraform`](https://github.com/wonjune0/terraform)

---

## 화면 구성

| 페이지 | 스크립트 | 내용 |
|---|---|---|
| `index.html` | `js/products.js` | 상품 목록, 카테고리 사이드바, 검색, 정렬, 페이징 |
| `product.html` | `js/product.js` | 상품 상세, 수량 선택, 장바구니 담기 / 바로구매 |
| `cart.html` | `js/cart.js` | 장바구니, 수량 변경, 선택 삭제, 부분 선택 주문 |
| `checkout.html` | `js/checkout.js` | 배송지(주소 검색), 배송 요청, 결제수단, 주문 생성 |
| `order-complete.html` | `js/order-complete.js` | 주문 완료 내역 |
| `login.html` | `js/login.js` | 로그인 |
| `signup.html` | `js/signup.js` | 회원가입 (약관 동의 포함) |

### 공통 모듈

| 파일 | 역할 |
|---|---|
| `js/api.js` | **모든 서버 통신의 단일 창구.** `fetch` 호출은 이 파일에만 존재 |
| `js/session.js` | 토큰·사용자 정보 보관, 로그인 가드, 헤더 인증 영역 렌더 |
| `js/cart-store.js` | 체크아웃 선택 항목, 마지막 주문번호, 헤더 배지 |
| `js/util.js` | 금액 포맷, HTML 이스케이프, 쿼리 파라미터, 헤더 검색 |

---

## 설계 판단

### `fetch`는 한 곳에만 둔다

`js/api.js`가 유일하게 `fetch`를 호출합니다. 각 페이지는 `api.products.list(...)`
같은 함수만 씁니다.

```js
export const api = {
  categories: { list },
  products:   { list, detail },
  auth:       { signup, login, me },
  cart:       { get, addItem, updateItem, removeItem, clear },
  orders:     { create, list, detail },
};
```

이렇게 모아두면 인증 헤더 부착, 401 처리, 에러 정규화를 한 번만 구현하면 됩니다.

**API 베이스 경로는 상대 경로입니다.**

```js
const API_BASE = window.__API_BASE__ ?? "";
```

운영에서는 CloudFront가 정적 파일과 `/api/*`를 같은 도메인에서 서비스하므로
`fetch("/api/products")`가 동일 출처 요청이 됩니다. **CORS가 개입할 여지가 없습니다.**
로컬에서 백엔드를 따로 띄울 때만 `window.__API_BASE__`로 주소를 바꿉니다.

### 두 가지 에러 형태를 하나로 정규화

백엔드는 상황에 따라 두 형태의 에러 본문을 보냅니다.

```json
{"message":"인증이 필요합니다"}
{"timestamp":"...","status":400,"error":"...","message":"...","path":"...","fieldErrors":[...]}
```

둘 다 `message`를 가지므로 `ApiError(status, message, fieldErrors)`로 통일해서 던집니다.
호출부는 형태를 구분할 필요가 없고, 회원가입 화면은 `fieldErrors`를 받아 해당 입력
아래에 서버 검증 메시지를 표시합니다.

### 장바구니 상태는 서버에만 둔다

localStorage에 장바구니를 두지 않습니다. `/api/cart`가 유일한 원본이고, 수량 변경·
삭제 같은 모든 조작은 **요청을 보낸 뒤 응답으로 화면을 다시 그립니다.**

```js
async function mutate(action) {
  items = (await action()).items;
  render();
}
```

낙관적 갱신을 하지 않으므로 화면이 서버와 어긋날 수 없고, 다른 기기에서 담은 상품도
그대로 보입니다. 대신 로그인이 필요하므로, 비로그인 상태에서 담기를 누르면 원래
보던 페이지를 `?redirect=`에 담아 로그인으로 보냅니다.

```js
window.location.href = loginUrl(`product.html?id=${product.id}`);
```

`redirect` 값은 같은 페이지 상대 경로만 허용합니다. 절대 URL이 들어오면 무시해서
오픈 리다이렉트를 막습니다.

### 필터·정렬·페이징은 서버가 한다

상품 목록을 전부 받아 브라우저에서 거르지 않고, 필요한 조각만 쿼리 파라미터로
요청합니다.

```js
api.products.list({ search, parentCategory, category, sort, page, size });
```

상품이 수만 건으로 늘어나도 브라우저가 받는 양은 한 페이지분으로 일정합니다.
느린 이전 응답이 새 응답을 덮어쓰지 않도록 요청 일련번호로 결과를 검사합니다.

```js
const seq = ++requestSeq;
// ...
if (seq !== requestSeq) return;   // 더 최신 요청이 있으면 폐기
```

카테고리 목록도 하드코딩하지 않고 `/api/categories`에서 받습니다. 사이드바가 보내는
카테고리 이름이 곧 상품 필터의 값이라, DB와 문자열이 어긋나면 조용히 0건이 되기
때문입니다.

### 주문 완료 화면은 서버에서 다시 읽는다

결제 후 sessionStorage에 **주문번호만** 저장하고, 완료 화면은 그 번호로
`/api/orders/{orderNumber}`를 다시 조회합니다.

- 새로고침해도 내용이 유지됩니다
- 주문번호·총액·항목이 모두 **서버가 기록한 값**입니다 (클라이언트가 계산하거나
  주문번호를 만들지 않습니다)

---

## 로컬 실행

정적 파일이므로 아무 정적 서버로 열면 됩니다. `file://`로 열면 ES 모듈이 동작하지
않으니 서버를 띄워야 합니다.

```bash
python3 -m http.server 5500
```

백엔드를 로컬에서 함께 띄웠다면 API 주소를 지정합니다. HTML의 모듈 스크립트 앞에
임시로 추가하면 됩니다.

```html
<script>window.__API_BASE__ = "http://localhost:8080";</script>
<script type="module" src="js/products.js"></script>
```

백엔드의 `local` 프로필이 `localhost` 출처에 대해 CORS를 허용합니다.

---

## 배포

`main` 브랜치 푸시 시 GitHub Actions가 다음을 수행합니다.

```
1. SSM Parameter Store에서 배포 대상 조회
     /seoul/frontend/bucket_name
     /seoul/frontend/distribution_id
2. aws s3 sync . s3://$BUCKET --delete   (.git, .github 제외)
3. CloudFront 캐시 무효화 (/*)
```

**배포 대상을 GitHub Secret에 저장하지 않습니다.** CloudFront 배포판 ID는 인프라를
재구축할 때마다 새로 발급되는데, Secret에 넣어두면 재구축마다 사람이 값을 갱신해야
합니다. Terraform이 SSM에 기록하고 워크플로가 실행 시점에 읽어가므로 이 단계가
없습니다.

빌드 단계가 없어 소스가 곧 배포 산출물입니다. `--delete`가 붙어 있어 리포에서
삭제된 파일은 버킷에서도 사라집니다.

---

## 알려진 한계

- **상품평 / 상품문의는 데모 데이터** — 백엔드에 해당 API가 없어
  `js/product.js`가 상품의 평점·리뷰 수를 바탕으로 화면용 항목을 생성합니다.
  기능이 아니라 화면 채움이라는 점을 코드 주석에 명시해 두었습니다.
- **실제 결제 없음** — 결제수단은 선택만 하고 PG 연동은 하지 않습니다.
- **토큰을 localStorage에 보관** — XSS가 발생하면 토큰이 노출될 수 있습니다.
  `expiresIn` 기반 만료 검사와 401 시 세션 정리는 구현되어 있지만,
  HttpOnly 쿠키 + 리프레시 토큰 구조가 더 안전합니다.
- **캐시 헤더 미설정** — 배포 때마다 CloudFront 전체를 무효화하는 방식입니다.
  정적 자산과 HTML에 서로 다른 `Cache-Control`을 부여하면 무효화 범위를 줄일 수
  있습니다.
- **주문 내역 페이지 없음** — `/api/orders` 목록 API는 있으나 화면이 없습니다.
