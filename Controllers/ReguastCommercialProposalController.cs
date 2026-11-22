using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using System.Web; // Для HttpUtility.HtmlEncode (защита от XSS)


namespace SUPPLY_API
{
    /// <summary>
    /// Запрос коммерческого предложения с формы обратной связи аутсорсинга снабжения
    /// </summary>

    [Controller]
    [Route("v1/[controller]")]
    public class ReguastCommercialProposalController : ControllerBase
    {
        private readonly TokenService _tokenService;
        private readonly SupplyContext _dbContext;
        private readonly EmailSender _emailSender;

        private readonly ApplicationLinks _appLink;

        public ReguastCommercialProposalController (
            TokenService tokenService,
            SupplyContext dbContext,
            EmailSender emailSender,
            IOptions<ApplicationLinks> options)
        {
            _tokenService = tokenService;
            _dbContext = dbContext;
            _emailSender = emailSender;
            _appLink = options.Value;
        }


        [HttpPost]
        public IActionResult Quote([FromBody] ReguastTestDriveModel model)
        {
            // 1. Проверяем скрытое поле на наличие спама
            if (!string.IsNullOrWhiteSpace(model.Company))
            {
                // Это бот! Возвращаем успешный статус (200 OK), чтобы он думал, 
                // что обманул систему, но данные в базу не сохраняем.
                return Ok(new { success = true, message = "Заявка успешно принята!" });
            }

            // 2. Если поле пустое — это реальный человек, валидируем основные данные
            if (!ModelState.IsValid)
            {
                return BadRequest(new { error = "Неверно заполнены поля формы" });
            }
           
            // 1. Безопасно экранируем данные, чтобы сломанная верстка или скрипты не попали в письмо
            string safeName = HttpUtility.HtmlEncode(model.Name);
            string safePhone = HttpUtility.HtmlEncode(model.Phone);
            string safeEmail = HttpUtility.HtmlEncode(model.Email);
            string safeLending = HttpUtility.HtmlEncode(model.Lending);

            // Регистрируем нового пользователя

            var user = _dbContext.CollaboratorSystem
                .FirstOrDefault(p => p.EmailCollaborator == model.Email);


            // 2. Формируем красивое HTML-тело письма
            string body = $@"
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset='utf-8'>
                <meta name='viewport' content='width=device-width, initial-scale=1.0'>
            </head>
            <body style='margin: 0; padding: 0; background-color: #f4f7f9; font-family: Arial, sans-serif;'>
                <table width='100%' cellpadding='0' cellspacing='0' style='background-color: #f4f7f9; padding: 40px 0;'>
                    <tr>
                        <td align='center'>
                            <!-- Основная карточка -->
                            <table width='600' cellpadding='0' cellspacing='0' style='background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden;'>
                                
                                <!-- Шапка -->
                                <tr>
                                    <td style='background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 24px; text-align: center;'>
                                        <h1 style='color: #ffffff; margin: 0; font-size: 20px; font-weight: 600;'>🔔 Новый запрос КП на аутсорсинг!</h1>
                                    </td>
                                </tr>

                                <!-- Тело письма -->
                                <tr>
                                    <td style='padding: 32px 24px;'>
                                        <p style='color: #334155; font-size: 16px; margin: 0 0 24px 0; line-height: 1.5;'>
                                            Здравствуйте! Поступил новый запрос коммерческого на аутсорсинг снабжения.
                                        </p>

                                        <!-- Блок с данными -->
                                        <table width='100%' cellpadding='0' cellspacing='0' style='background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 24px;'>
                                            <tr>
                                                <td style='padding: 16px;'>
                                                    <p style='margin: 0 0 8px 0; color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;'>Лендинг = {safeLending}</p>
                                                    <p style='margin: 0; color: #0f172a; font-size: 18px; font-weight: 700;'>{safeName}</p>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style='padding: 16px; border-top: 1px solid #e2e8f0;'>
                                                    <p style='margin: 0 0 8px 0; color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;'>Контактная почта клиента</p>
                                                    <p style='margin: 0; color: #2563eb; font-size: 16px; font-weight: 600;'>
                                                        <a href='tel:{safePhone}' style='color: #2563eb; text-decoration: none;'>{safePhone}</a>
                                                        <br>
                                                        <a href='mailto:{safeEmail}' style='color: #2563eb; text-decoration: none;'>{safeEmail}</a>
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>

                                        <!-- Кнопка действия -->
                                        <table width='100%' cellpadding='0' cellspacing='0'>
                                            <tr>
                                                <td align='center'>
                                                    <a href='mailto:{safeEmail}?subject=Коммерческое предложение по запросу' 
                                                    style='display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);'>
                                                        ✉️ Написать клиенту
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <!-- Подвал -->
                                <tr>
                                    <td style='background-color: #f1f5f9; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;'>
                                        <p style='margin: 0; color: #64748b; font-size: 13px;'>
                                            Это автоматическое уведомление с сайта. Пожалуйста, обработайте заявку в ближайшее время.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>";

            // 3. Отправляем письмо (убедись, что твой _emailSender поддерживает isHtml: true)
            _emailSender.SendEmail(
                "gubinvs@gmail.com", 
                $"🔥 Новый запрос КП на аутсорсинг!", 
                body
            );

            return Ok(new { message = "Запрос успешно отправлен" });
        }
    }
};