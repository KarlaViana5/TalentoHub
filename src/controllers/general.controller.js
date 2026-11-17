const { registrarError } = require('../utils/logger');

const { buscarVacantes } = require('../services/vacantes.service');
const { buscarRecursos } = require('../services/recursos.service');

const generalController = {

    mostrarInicio: async (req, res) => {
        try {
            const [resultadoVacantes, resultadoRecursos] = await Promise.all([
                buscarVacantes(
                    { orden: 'recientes' },
                    {
                        limite: 3,
                        pagina: 1
                    }
                ),
                buscarRecursos(
                    { orden: 'recientes' },
                    {
                        limite: 3,
                        pagina: 1
                    }
                )
            ]);

            res.render('general/inicio', {
                titulo: 'TalentoHub',
                mensaje: 'Conectamos tu talento con nuevas oportunidades.',
                vacantes: resultadoVacantes.vacantes,
                totalVacantes: resultadoVacantes.totalResultados,
                recursos: resultadoRecursos.recursos
            });

        } catch (error) {
            registrarError(error, { scope: 'controller:general', req });

            throw error;
        }
    }

};

module.exports = generalController;
