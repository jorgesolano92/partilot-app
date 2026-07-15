import { Component, OnInit } from '@angular/core';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-preguntas-frecuentes',
  templateUrl: './preguntas-frecuentes.page.html',
  styleUrls: ['./preguntas-frecuentes.page.scss'],
  standalone: false,
})
export class PreguntasFrecuentesPage implements OnInit {

  preguntas: any[] = [];
  preguntasFiltradas: any[] = [];
  terminoBusqueda: string = '';

  constructor(public authService: AuthService) { }

  ngOnInit() {
    this.cargarPreguntas();
  }

  cargarPreguntas() {
    this.preguntas = [
      {
        pregunta: '¿Cómo puedo participar en los sorteos?',
        respuesta: 'Para participar en los sorteos, debes comprar una participación desde la aplicación. Puedes hacerlo desde la sección de venta o escaneando un código QR de un vendedor autorizado.'
      },
      {
        pregunta: '¿Cómo sé si he ganado?',
        respuesta: 'Recibirás una notificación automática si has ganado algún premio. También puedes consultar tus resultados en la sección "Resultados" de tu perfil, donde se mostrarán todos tus sorteos y si has ganado.'
      },
      {
        pregunta: '¿Cómo cobro mis premios?',
        respuesta: 'Puedes cobrar tus premios desde la sección "Cobro de Participaciones" en tu perfil. Una vez que el sorteo haya finalizado y hayas ganado, aparecerá un botón para procesar el cobro. El dinero se transferirá según el método de pago que tengas configurado.'
      },
      {
        pregunta: '¿Puedo regalar una participación?',
        respuesta: 'Sí, puedes regalar participaciones a otros usuarios desde la sección "Regalar Participación" en tu cartera. Solo necesitas seleccionar la participación y proporcionar el correo electrónico del destinatario.'
      },
      {
        pregunta: '¿Cómo digitalizo mi participación física?',
        respuesta: 'Puedes digitalizar tu participación usando la cámara de tu dispositivo desde la sección "Digitalizar Participación". Toma una foto del boleto y completa la información requerida. La participación quedará guardada en tu cartera digital.'
      },
      {
        pregunta: '¿Cuándo se realizan los sorteos?',
        respuesta: 'Los sorteos se realizan diariamente a las 19:00 horas. Puedes ver la cuenta regresiva en la página principal de la aplicación. Asegúrate de comprar tu participación antes de esa hora.'
      },
      {
        pregunta: '¿Qué pasa si pierdo mi boleto físico?',
        respuesta: 'Si has digitalizado tu participación en la aplicación, no hay problema. Todas tus participaciones digitalizadas quedan guardadas en tu cartera y puedes verificar tus números en cualquier momento. Si solo tenías el boleto físico y no lo digitalizaste, contacta con el vendedor o soporte.'
      },
      {
        pregunta: '¿Cómo cambio mi método de pago?',
        respuesta: 'Puedes cambiar tu método de pago desde la sección "Cobrar y Gestionar" > "Configurar Método de Pago" en tu perfil. Allí podrás agregar, editar o eliminar métodos de pago.'
      },
      {
        pregunta: '¿Puedo cancelar una participación?',
        respuesta: 'Las participaciones solo se pueden cancelar antes de que comience el sorteo. Si ya compraste una participación y el sorteo no ha comenzado, contacta con soporte para solicitar la cancelación y reembolso.'
      },
      {
        pregunta: '¿Cómo funcionan las participaciones en la lotería social?',
        respuesta: 'La lotería social te permite crear o unirte a sorteos grupales. Puedes invitar a tus amigos y familiares a participar juntos. Si el grupo gana, el premio se divide entre todos los participantes según las participaciones que cada uno haya comprado.'
      },
      {
        pregunta: '¿Qué información personal se comparte?',
        respuesta: 'Tu información personal está protegida y solo se comparte con los servicios necesarios para procesar tus transacciones. Puedes revisar nuestra política de privacidad en la sección "Condiciones Legales" de la aplicación.'
      },
      {
        pregunta: '¿Hay un límite de participaciones por sorteo?',
        respuesta: 'No hay un límite estricto, pero recomendamos participar de forma responsable. Puedes comprar múltiples participaciones para el mismo sorteo si lo deseas.'
      }
    ];

    this.preguntasFiltradas = this.preguntas;
  }

  buscar() {
    if (!this.terminoBusqueda || this.terminoBusqueda.trim() === '') {
      this.preguntasFiltradas = this.preguntas;
      return;
    }

    const termino = this.terminoBusqueda.toLowerCase().trim();
    this.preguntasFiltradas = this.preguntas.filter(p => 
      p.pregunta.toLowerCase().includes(termino) || 
      p.respuesta.toLowerCase().includes(termino)
    );
  }

}
